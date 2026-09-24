# Kinara

**Hook-first microservice framework for Node.js.** Copy a folder into `modules/` and it runs — routes, hooks, gRPC, and providers are discovered for you.

[github.com/kinarajs/kinara](https://github.com/kinarajs/kinara)

```bash
npm install @kinarajs/kinara
```

> **0.0.1 — not stable.** Kinara is in early development. APIs, method names, folder conventions, and config keys can change without a deprecation window. Pin a version and expect breaking changes until 1.0.0.

Kinara is open source. Use it for any project, personal or commercial.

```
src/modules/auth/hooks/log-signup.ts   →  listens to user.created
src/modules/auth/routes.ts             →  HTTP routes
src/modules/auth/rpc.ts                →  gRPC service
src/modules/auth/providers/            →  optional module services
```

## Why Kinara

| You want | Kinara does |
| --- | --- |
| Hooks, not ceremony | `defineHook({ on: "user.created", handle })` |
| Copy a folder, it works | Anything under `modules/<name>/{hooks,routes,rpc,providers}` loads on boot |
| One response shape | `{ ok, data }` / `{ ok: false, error }` |
| Permissions | Role → permission gate, HTTP and gRPC |
| Microservices | HTTP + built-in gRPC + pluggable event bus |
| Dev vs prod | Smaller payloads, HSTS, rate limits, JSON logs, `trust proxy` in production |
| Observability | Plug any OpenTelemetry adapter; optional S3 log sink |
| Data | Streaming Mongo ORM, field encryption, Redis/memory cache |
| CLI | Laravel-style `kinara make:*`, `serve`, `key:generate` |
| Realtime | WebSockets (`ws`) with rooms |
| Media | Sharp image optimize + store |

## Quick start

```ts
import { createApp } from "@kinarajs/kinara";

const app = await createApp({ root: import.meta.dirname });
await app.listen(3000);
```

Already have Express routes? Mount them and keep working:

```ts
const app = await createApp({ root: import.meta.dirname, rateLimit: false });
app.use("/sms", smsRouter);          // or app.mount(existingExpressApp)
await app.listen(4500);
await app.emitSafe("sms.started", { port: 4500 });
```

`createApp` loads `.env`, serves `/health` and `/healthz`, and waits until `listen()` to attach the 404 handler so you can still `use()` / `mount()` after boot. CommonJS services can `const { createApp } = await import("@kinarajs/kinara")`.

```ts
// src/modules/auth/hooks/log-user-signup.ts
import { defineHook } from "@kinarajs/kinara";

export default defineHook({
  id: "log-user-signup",
  on: "user.created",
  async handle(payload) {
    console.log("signed up", payload);
  },
});
```

```ts
// src/modules/auth/routes.ts
import { event, handle, ok, ValidationError } from "@kinarajs/kinara";
import type { RouteRegistrar } from "@kinarajs/kinara";

const routes: RouteRegistrar = (_http, router) => {
  router.post("/signup", handle(async (req, res) => {
    const email = String(req.body?.email ?? "");
    if (!email.includes("@")) throw new ValidationError("Invalid email");
    const user = { id: Date.now(), email };
    await event().emit("user.created", user);
    res.status(201).json(ok(user));
  }));
};

export default routes;
```

Or scaffold a service:

```bash
npx kinara new billing-service
cd billing-service
npm install
kinara serve
```

## Layout

```
src/
  index.ts
  config/
    app.ts
    events.ts
    permissions.ts
    cache.ts
    rateLimit.ts
  middleware/
  modules/
    auth/
      routes.ts
      rpc.ts
      hooks/
        log-user-signup.ts
      providers/
```

`createApp({ root })` should point at the folder that contains `modules/` and `config/`.

## Runtime modes

| | development | production |
| --- | --- | --- |
| Logs | pretty | JSON, request id |
| Body limit | 1mb | 256kb |
| Security headers | nosniff, DENY frame | + HSTS |
| Rate limit | off unless enabled | on (60/min default) |
| `trust proxy` | off | on |

```bash
NODE_ENV=production node dist/index.js
# or
KINARA_ENV=production KINARA_DEBUG=1 node dist/index.js
```

## HTTP responses and errors

Throw a Kinara error. The envelope is written for you.

```ts
import { handle, NotFoundError, ok } from "@kinarajs/kinara";

router.get("/users/:id", handle(async (req, res) => {
  const user = await findUser(req.params.id);
  if (!user) throw new NotFoundError("User");
  res.json(ok(user));
}));
```

```json
{ "ok": true, "data": { "id": "u_1" } }
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "User not found" }, "meta": { "requestId": "…" } }
```

`ValidationError`, `UnauthorizedError`, `ForbiddenError`, `RateLimitError`, `ConflictError`, `BadRequestError` are built in.

Wrap routes with `handle()` so thrown errors become envelopes. `app.exceptions` reports 5xx (log + trace) and hides internal messages in production. Use `rescue()` when a fallback is enough:

```ts
const user = await rescue(() => User.find(id), null);
```

## Permissions

```ts
// src/config/permissions.ts
export default {
  roles: {
    admin: ["*"],
    member: ["user.read", "billing.invoices.read"],
  },
};
```

```ts
router.get("/admin/users", app.permissions.authorize("users.read"), handler);
```

Wildcards work: `billing.*` grants `billing.invoices.read`.

## gRPC

Drop `rpc.ts` next to `routes.ts`. Kinara loads `@grpc/grpc-js` only when a module exports a service.

```ts
import { defineRpc, NotFoundError } from "@kinarajs/kinara";

export default defineRpc({
  package: "auth.v1",
  service: "AuthService",
  proto: `
    syntax = "proto3";
    package auth.v1;
    service AuthService { rpc GetUser (GetUserRequest) returns (User); }
    message GetUserRequest { string id = 1; }
    message User { string id = 1; string email = 2; }
  `,
  methods: {
    GetUser: async (req, { app }) => {
      const user = await app.mongo?.db().collection("users").findOne({ id: req.id });
      if (!user) throw new NotFoundError("User");
      return user;
    },
  },
});
```

```bash
npm install @grpc/grpc-js @grpc/proto-loader
GRPC_PORT=50051
```

## Events

```ts
import { event } from "@kinarajs/kinara";

await event().emit("invoice.paid", { id: "in_1", total: 4200 });
```

Default driver is in-memory. For multiple services:

```ts
// src/config/events.ts
export default { driver: "rabbitmq", rabbitmq: { url: process.env.RABBITMQ_URL } };
```

```bash
npm install amqplib
```

Register your own driver with `createApp({ events: { drivers: { nats: createNats } } })`.

## Cache, Mongo, rate limit

```ts
// src/config/cache.ts
export default { driver: "redis", redis: { url: process.env.REDIS_URL } };

// src/config/mongo.ts  — or set MONGO_URL
export default { url: process.env.MONGO_URL };

// src/config/rateLimit.ts
export default { enabled: true, max: 120, windowMs: 60_000 };
```

```ts
const plan = await app.cache.wrap("plan:pro", 60_000, () => loadPlan("pro"));
```

Peers: `ioredis`, `mongodb`.

## Mongo ORM, pagination, CSV, encryption

The ORM is a thin cursor over Mongo (or an in-memory collection when `MONGO_URL` is unset). It does not load whole collections.

```ts
import { defineModel } from "@kinarajs/kinara";

export const User = defineModel<{ _id: string; email: string; ssn?: string }>({
  collection: "users",
  encrypt: ["ssn"],
});

await User.create({ email: "ada@example.com", ssn: "000-00-0000" });
const page = await User.paginate(1, 50);          // offset pages (max 200)
const next = await User.query().cursorPaginate(50, pageCursor);
for await (const user of User.cursor()) { /* one row */ }
await User.toCsv((chunk) => res.write(chunk), ["_id", "email"]);
```

`encrypt` fields use AES-256-GCM. Generate a key with `kinara key:generate` and set `KINARA_KEY` or `crypto.key`.

## WebSockets

```bash
npm install ws
```

```ts
// src/config/app.ts
export default { websocket: true };

app.ws.onConnection((client) => {
  client.join("ops");
  client.send("hello", { id: client.id });
});
app.ws.to("ops").emit("deployed", { version: "1.2.3" });
```

Payloads are `{ event, payload, meta: { requestId } }`. Emits are traced.

## Images

```bash
npm install sharp
```

```ts
import { optimizeImage, storeImage } from "@kinarajs/kinara";

const webp = await optimizeImage(file, { width: 1200, format: "webp", quality: 80 });
await storeImage(app.storage.disk("local"), `avatars/${id}.webp`, file, { width: 256, format: "webp" });
```

## OpenTelemetry and S3 logs

```ts
import { createApp, useOpenTelemetry } from "@kinarajs/kinara";
import { trace } from "@opentelemetry/api";

useOpenTelemetry({ trace });
const app = await createApp({ root: import.meta.dirname });
```

Any adapter with `getTracer().startSpan()` works — you are not locked to one SDK.

```ts
// src/config/log.ts
export default { s3: { bucket: "my-service-logs", prefix: "kinara", region: "ap-south-1" } };
```

```bash
npm install @aws-sdk/client-s3
```

## CLI

```
kinara list
kinara new billing-service
kinara serve
kinara make:module billing
kinara make:hook billing flag-invoice invoice.paid
kinara make:model invoice
kinara key:generate
```

## Samples

Example services live in [`samples/`](./samples):

| Sample | Shows |
| --- | --- |
| [starter](./samples/starter) | health + signup hook |
| [auth-service](./samples/auth-service) | signup, sessions, permissions, gRPC GetUser |
| [billing-service](./samples/billing-service) | invoices, cache, rate limit, RabbitMQ-ready events |
| [notify-service](./samples/notify-service) | email/SMS hooks, OTEL span, S3 log config |

Docs: [Getting started](./docs/getting-started.md) · [Hooks](./docs/hooks.md) · [HTTP](./docs/http.md) · [gRPC](./docs/grpc.md) · [Permissions](./docs/permissions.md) · [Errors](./docs/errors.md) · [ORM](./docs/orm.md) · [WebSockets](./docs/websocket.md) · [Images](./docs/media.md) · [Cache](./docs/caching.md) · [MongoDB](./docs/mongodb.md) · [Telemetry](./docs/telemetry.md) · [Security](./docs/security.md) · [Production](./docs/production.md) · [CLI](./docs/cli.md)

## License

[ISC](./LICENSE). Use it for anything.

## Publish

CI runs on Node 20 / 22 / 24. Creating a GitHub release (or pushing `v*`) publishes `@kinarajs/kinara` to npm with provenance.
