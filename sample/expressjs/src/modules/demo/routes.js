import { event, ok } from "@kinarajs/kinara";

export default (_http, router, middleware) => {
  router.get("/health", (_req, res) => res.json(ok({ status: "ok" })));

  router.get("/secure", middleware("auth"), (_req, res) => {
    res.json(ok({ message: "You are authorized" }));
  });

  router.post("/signup", async (_req, res) => {
    const payload = { id: Date.now(), email: "demo@example.com" };
    await event().emit("user.created", payload);
    res.status(201).json(ok(payload));
  });
};
