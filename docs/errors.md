# Errors

Throw. Do not `res.status(404).json(...)` by hand unless you have a reason.

```ts
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  handle,
  rescue,
} from "@kinarajs/kinara";

router.post("/users", handle(async (req, res) => {
  if (!req.body?.email) throw new ValidationError("email is required", { field: "email" });
  if (await exists(req.body.email)) throw new ConflictError("Email already registered");
  res.json(ok(user));
}));
```

| Class | Status | Code |
| --- | --- | --- |
| `BadRequestError` | 400 | `BAD_REQUEST` |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` |
| `ForbiddenError` | 403 | `FORBIDDEN` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |
| `ValidationError` | 422 | `VALIDATION_ERROR` |
| `RateLimitError` | 429 | `RATE_LIMITED` |
| `KinaraError` | custom | custom |

`app.exceptions` reports 5xx (log + OTEL span) and renders the envelope. Client errors are not reported. In production, 5xx messages are hidden. Every error includes `meta.requestId`.

```ts
const user = await rescue(() => User.find(id), null);
app.exceptions.reportUsing(async (error) => {
  // optional extra sink
});
```
