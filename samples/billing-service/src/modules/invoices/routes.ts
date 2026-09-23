import { NotFoundError, ValidationError, event, handle, ok, paginated, toInt } from "@kinarajs/kinara";
import type { RouteRegistrar } from "@kinarajs/kinara";
import { id } from "@kinarajs/kinara";

interface Invoice {
  id: string;
  customerId: string;
  total: number;
  status: "open" | "paid";
}

const invoices = new Map<string, Invoice>();

const routes: RouteRegistrar = (http, router) => {
  const app = http.get("kinara");

  router.get("/health", (_req, res) => res.json(ok({ service: "billing" })));

  router.post(
    "/invoices",
    handle(async (req, res) => {
      const customerId = String(req.body?.customerId ?? "");
      const total = toInt(req.body?.total, 0);
      if (!customerId) throw new ValidationError("customerId required");
      if (total <= 0) throw new ValidationError("total must be positive");
      const invoice: Invoice = { id: id(), customerId, total, status: "open" };
      invoices.set(invoice.id, invoice);
      await app.cache.set(`invoice:${invoice.id}`, invoice, 60_000);
      res.status(201).json(ok(invoice));
    })
  );

  router.get(
    "/invoices",
    handle(async (req, res) => {
      const page = toInt(req.query.page, 1);
      const items = [...invoices.values()];
      res.json(paginated(items, { page, pageSize: 20, total: items.length }));
    })
  );

  router.get(
    "/invoices/:id",
    handle(async (req, res) => {
      const invoice = await app.cache.wrap(`invoice:${req.params.id}`, 15_000, async () => {
        return invoices.get(req.params.id);
      });
      if (!invoice) throw new NotFoundError("Invoice");
      res.json(ok(invoice));
    })
  );

  router.post(
    "/invoices/:id/pay",
    handle(async (req, res) => {
      const invoice = invoices.get(req.params.id);
      if (!invoice) throw new NotFoundError("Invoice");
      invoice.status = "paid";
      await app.cache.set(`invoice:${invoice.id}`, invoice, 60_000);
      await event().emit("invoice.paid", invoice);
      res.json(ok(invoice));
    })
  );
};

export default routes;
