import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp, resetCurrentApp } from "../src/app.js";
import { MiddlewareManager } from "../src/http/middleware.js";
import { cleanup, tempRoot, write } from "./helpers.js";

const roots: string[] = [];

afterEach(async () => {
  resetCurrentApp();
  await Promise.all(roots.splice(0).map((root) => cleanup(root)));
});

describe("middleware manager", () => {
  it("resolves named middleware and rejects unknown names", () => {
    const manager = new MiddlewareManager();
    manager.register("auth", () => (_req, _res, next) => next());
    expect(typeof manager.resolve("auth")).toBe("function");
    expect(() => manager.resolve("missing")).toThrow(/not registered/);
  });
});

describe("named + global middleware", () => {
  it("applies configured middleware to routes", async () => {
    const root = await tempRoot();
    roots.push(root);

    await write(
      root,
      "middleware/auth.js",
      `
        export default () => (req, res, next) => {
          if (req.headers.authorization === 'Bearer secret') return next();
          res.status(401).json({ error: 'unauthorized' });
        };
      `
    );
    await write(
      root,
      "config/middleware.js",
      `
        export default {
          global: [],
          named: { auth: 'middleware/auth.js' }
        };
      `
    );
    await write(
      root,
      "modules/demo/routes.js",
      `
        export default (http, router, middleware) => {
          router.get('/secure', middleware('auth'), (req, res) => {
            res.json({ message: 'You are authorized' });
          });
        };
      `
    );

    const app = await createApp({ root, quiet: true });
    const denied = await request(app.http!).get("/secure");
    expect(denied.status).toBe(401);

    const allowed = await request(app.http!)
      .get("/secure")
      .set("Authorization", "Bearer secret");
    expect(allowed.status).toBe(200);
    expect(allowed.body.message).toBe("You are authorized");
    await app.close();
  });
});
