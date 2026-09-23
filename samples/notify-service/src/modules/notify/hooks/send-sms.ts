import { defineHook, maskPhone, withSpan } from "@kinarajs/kinara";

export default defineHook({
  id: "send-sms",
  on: "invoice.paid",
  async handle(payload, { app }) {
    const phone = String((payload as { phone?: string }).phone ?? "");
    await withSpan("notify.sms", async (span) => {
      span.setAttribute?.("notify.phone", maskPhone(phone || "0000"));
      app.logger.info("sms queued", { invoice: (payload as { id?: string }).id });
    });
  },
});
