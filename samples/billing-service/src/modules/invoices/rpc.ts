import { NotFoundError, defineRpc } from "@kinarajs/kinara";

export default defineRpc({
  package: "billing.v1",
  service: "BillingService",
  proto: `
    syntax = "proto3";
    package billing.v1;
    service BillingService { rpc GetInvoice (GetInvoiceRequest) returns (Invoice); }
    message GetInvoiceRequest { string id = 1; }
    message Invoice { string id = 1; string customerId = 2; int32 total = 3; string status = 4; }
  `,
  methods: {
    GetInvoice: async (req, { app }) => {
      const invoice = await app.cache.get(`invoice:${req.id}`);
      if (!invoice) throw new NotFoundError("Invoice");
      return invoice;
    },
  },
});
