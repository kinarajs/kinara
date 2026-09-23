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

Unknown routes return the same envelope with `NOT_FOUND`.

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
