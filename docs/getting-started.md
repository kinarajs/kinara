# Getting started

## Install

```bash
npm install @kinarajs/kinara
```

> **0.0.1 is not stable.** Method names, config keys, and folder conventions can change before 1.0.0.

Node 20 or newer. TypeScript is first-class; compiled JavaScript modules also load.

## First service

```bash
npx kinara new invoice-api
cd invoice-api
npm install
kinara serve
```

Or by hand:

```
src/index.ts
src/config/app.ts
src/modules/invoices/routes.ts
src/modules/invoices/hooks/log-paid.ts
```

`createApp({ root: import.meta.dirname })` must point at the directory that contains `modules/` and `config/`.

## What boots

1. Config files in `config/`
2. Optional Mongo / Redis / S3 / OTEL
3. Event driver (`memory` or `rabbitmq`)
4. Permission roles
5. HTTP (security headers, request id, optional rate limit)
6. Module providers, named middleware, hooks, routes, gRPC
7. Built-in `/health` and `/healthz` (disable with `health: false`)
8. You can `app.use()` / `app.mount()` more routes after boot
9. `listen()` attaches the envelope 404 + error handler

`boot({ serviceName, port, onReady })` is the process entry: it calls `createApp`, connects `MONGO_URI` when set, listens, emits `${serviceName}.started`, and closes on SIGINT and SIGTERM. Pass `signals: false` in tests.

## Next

- [Hooks](./hooks.md)
- [HTTP and responses](./http.md)
- [Production](./production.md)
