import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
  event,
  handle,
  isEmail,
  ok,
  timingSafeEqual,
} from "@kinarajs/kinara";
import type { RouteRegistrar } from "@kinarajs/kinara";
import { hash } from "@kinarajs/kinara";
import {
  createUser,
  findByEmail,
  issueToken,
  publicUser,
  userFromToken,
} from "./store.js";

const routes: RouteRegistrar = (http, router) => {
  const app = http.get("kinara");

  router.get("/health", (_req, res) => res.json(ok({ service: "auth" })));

  router.post(
    "/signup",
    handle(async (req, res) => {
      const email = String(req.body?.email ?? "");
      const password = String(req.body?.password ?? "");
      if (!isEmail(email)) throw new ValidationError("Valid email required", { field: "email" });
      if (password.length < 8) throw new ValidationError("Password too short", { field: "password" });
      if (findByEmail(email)) throw new ConflictError("Email already registered");

      const user = createUser(email, password);
      await event().emit("user.created", publicUser(user));
      res.status(201).json(ok({ user: publicUser(user), token: issueToken(user) }));
    })
  );

  router.post(
    "/login",
    handle(async (req, res) => {
      const email = String(req.body?.email ?? "");
      const password = String(req.body?.password ?? "");
      const user = findByEmail(email);
      if (!user || !timingSafeEqual(user.passwordHash, hash(password))) {
        throw new UnauthorizedError("Invalid credentials");
      }
      res.json(ok({ user: publicUser(user), token: issueToken(user) }));
    })
  );

  router.get(
    "/me",
    (req, _res, next) => {
      const token = String(req.headers.authorization ?? "").replace("Bearer ", "");
      const user = userFromToken(token);
      if (!user) {
        next(new UnauthorizedError());
        return;
      }
      req.actor = { id: user.id, roles: user.roles };
      next();
    },
    app.permissions.authorize("user.read"),
    handle(async (req, res) => {
      const user = userFromToken(String(req.headers.authorization ?? "").replace("Bearer ", ""));
      res.json(ok(publicUser(user!)));
    })
  );
};

export default routes;
