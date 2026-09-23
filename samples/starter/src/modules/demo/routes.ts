import { event, handle, ok } from "@kinarajs/kinara";
import type { RouteRegistrar } from "@kinarajs/kinara";

const routes: RouteRegistrar = (_http, router) => {
  router.get("/health", (_req, res) => res.json(ok({ status: "ok" })));

  router.post(
    "/signup",
    handle(async (_req, res) => {
      const user = { id: Date.now(), email: "ada@example.com" };
      await event().emit("user.created", user);
      res.status(201).json(ok(user));
    })
  );
};

export default routes;
