import { defineHook } from "@kinarajs/kinara";

export default defineHook({
  id: "emit-welcome",
  on: "user.created",
  async handle(payload, { app }) {
    await app.emit("notify.email.requested", {
      template: "welcome",
      to: (payload as { email: string }).email,
    });
  },
});
