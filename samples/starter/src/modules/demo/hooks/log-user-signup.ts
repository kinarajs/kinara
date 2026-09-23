import { defineHook } from "@kinarajs/kinara";

export default defineHook({
  id: "log-user-signup",
  on: "user.created",
  async handle(payload, { app }) {
    app.logger.info("user.created", payload as Record<string, unknown>);
  },
});
