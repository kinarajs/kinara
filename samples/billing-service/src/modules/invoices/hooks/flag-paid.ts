import { defineHook } from "@kinarajs/kinara";

export default defineHook({
  id: "flag-invoice-paid",
  on: "invoice.paid",
  async handle(payload, { app }) {
    app.logger.info("invoice.paid", payload as Record<string, unknown>);
  },
});
