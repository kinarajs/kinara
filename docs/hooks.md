# Hooks

Hooks are how Kinara reacts to events. Prefer `defineHook` over classes.

```ts
import { defineHook } from "@kinarajs/kinara";

export default defineHook({
  id: "log-user-signup",
  name: "Log user signup",
  on: "user.created",
  async handle(payload, { event, app }) {
    app.logger.info(event, { email: payload.email });
  },
});
```

Put the file in `modules/<name>/hooks/`. Kinara scans that folder only.

`defineLogHook("log-auth", ["user.created", "auth.started"])` is the same hook with the payload passed to `app.logger.info`. Logger meta accepts `unknown`, so hook payloads do not need a cast.

`on` can be a list or a safe wildcard: `user.*`.

## Emit

```ts
import { event } from "@kinarajs/kinara";

await event().emit("user.created", { id: "u_1", email: "ada@yalu.dev" });
```

Event names must look like `user.created` or `billing:invoice-paid`. Path fragments and spaces are rejected.

## Class style

```ts
import { BaseHook } from "@kinarajs/kinara";

export default class LogUserSignup extends BaseHook<{ email: string }> {
  meta() {
    return { id: "log-user-signup" };
  }
  listenTo() {
    return ["user.created"];
  }
  async handle(payload) {
    console.log(payload.email);
  }
}
```

## Cross-service bus

```ts
export default {
  driver: "rabbitmq",
  rabbitmq: { url: process.env.RABBITMQ_URL, prefix: "kinara" },
};
```

Payloads are sanitized (prototype pollution stripped) before they leave the process.
