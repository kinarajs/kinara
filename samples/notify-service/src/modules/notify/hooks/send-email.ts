import { defineHook, maskEmail, withSpan } from "@kinarajs/kinara";

export default defineHook({
  id: "send-email",
  on: ["notify.email.requested", "user.created"],
  async handle(payload, { event, app }) {
    const to = String((payload as { to?: string; email?: string }).to ?? (payload as { email?: string }).email ?? "");
    await withSpan("notify.email", async (span) => {
      span.setAttribute?.("notify.to", maskEmail(to));
      span.setAttribute?.("notify.event", event);
      app.logger.info("email queued", { event, to: maskEmail(to) });
    });
  },
});
