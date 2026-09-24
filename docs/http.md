# HTTP and responses

Kinara mounts Express 5, JSON, a router, and an envelope error handler.

Every success should look the same:

```ts
import { handle, ok, paginated, sendCreated } from "@kinarajs/kinara";

router.get("/invoices", handle(async (req, res) => {
  const page = Number(req.query.page ?? 1);
  res.json(paginated(items, { page, pageSize: 20, total: items.length }));
}));

router.post("/invoices", handle(async (req, res) => {
  sendCreated(res, invoice);
}));
```

```json
{
  "ok": true,
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "total": 0, "pages": 1 }
}
```

Wrap route functions with `handle()` so `throw new NotFoundError("Invoice")` becomes:

```json
{
  "ok": false,
  "error": { "code": "NOT_FOUND", "message": "Invoice not found" },
  "meta": { "requestId": "ab12…" }
}
```

Unknown routes return the same envelope with `NOT_FOUND`. That handler is attached in `listen()` (or `finalizeHttp()`), so existing routers can be mounted after `createApp`:

```ts
const app = await createApp({ root: import.meta.dirname, rateLimit: false });
app.use("/v1", legacyRouter);
app.mount(existingExpressApp);
await app.listen(3000);
```

`/health` and `/healthz` are registered for you (`{ ok, data: { status: "ok", service } }`). Set `serviceName` or `app.name`. Pass `health: false` to skip.

Body size defaults to 1mb (256kb in production). Override with `createApp({ http: { jsonLimit: "100mb" } })` or `app.bodyLimit` in config.

## Middleware

```ts
// src/config/middleware.ts
export default {
  global: ["requestId"],
  named: { auth: "middleware/auth.ts" },
};
```

```ts
import type { MiddlewareFactory } from "@kinarajs/kinara";

const auth: MiddlewareFactory = (app) => (req, _res, next) => {
  const token = String(req.headers.authorization ?? "").replace("Bearer ", "");
  const actor = verify(token);
  if (actor) req.actor = actor;
  next();
};

export default auth;
```

```ts
router.get("/secure", middleware("auth"), handler);
```

`x-request-id` is always set. Pass one in to correlate gateway and service logs.

## Existing `{ success }` APIs

Pass `responses: "legacy"` to keep the auth-service body. Thrown `ValidationError` field maps, Mongoose `ValidationError`, and Mongo duplicate key `11000` become:

```json
{ "success": false, "code": 422, "name": "ValidationException", "errors": { "email": "required" } }
```

A string error keeps the exception name (`validationException`). 5xx bodies are `{ "success": false, "msg": "something went wrong" }`.

```ts
import { handle, sendLegacy, validate } from "@kinarajs/kinara";

router.post("/login", handle(async (req, res) => {
  const body = await validate(loginSchema, req.body);
  sendLegacy(res, await login(body));
}));
```

`validate()` accepts any schema with Yup's `validate(data, { abortEarly: false })` shape.

CORS and cookies are built in. `createApp({ cors: { origin: true, credentials: true }, cookies: true })`, or export the same objects from `config/cors.ts` and `config/cookies.ts` (`{ enabled: true }`).

## Resources

A resource is the allow-list for one response. Fields you do not name are not serialized, and `whenLoaded` never populates a relation.

```ts
import { defineResource, whenLoaded } from "@kinarajs/kinara";

export const UserResource = defineResource((user) => ({
  id: user._id,
  email: user.email,
  memberships: whenLoaded(user, "memberships", (rows) => MembershipResource.collection(rows as never[])),
}));

res.json(ok(UserResource.make(user)));
res.json(ok(UserResource.collection(users)));
```

Load relations in the query (`populate`) before calling the resource. An ObjectId is treated as not loaded and the key is omitted.
