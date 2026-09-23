import { ok } from "@kinarajs/kinara";
import type { RouteRegistrar } from "@kinarajs/kinara";

const routes: RouteRegistrar = (_http, router) => {
  router.get("/health", (_req, res) => res.json(ok({ service: "notify" })));
};

export default routes;
