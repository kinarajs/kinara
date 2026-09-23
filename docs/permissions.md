# Permissions

Roles live in config. Permissions are strings. Wildcards are prefix-safe (`billing.*`).

```ts
// src/config/permissions.ts
export default {
  roles: {
    admin: ["*"],
    support: ["user.read", "billing.invoices.read"],
    member: ["user.read", "billing.invoices.read.own"],
  },
};
```

```ts
router.delete(
  "/users/:id",
  middleware("auth"),
  app.permissions.authorize("users.delete"),
  handle(async (req, res) => { /* … */ })
);
```

Attach the actor on the request (`req.actor = { id, roles, permissions }`) or via `setActor()`. Missing actor → `401`. Missing permission → `403`.

```ts
app.permissions.assert(actor, "billing.refund");
app.permissions.can(actor, "billing.refund");
```

Keep permission names stable (`resource.action`) so services can share the same catalog.
