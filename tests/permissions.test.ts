import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp, resetCurrentApp } from "../src/app.js";
import { ForbiddenError, UnauthorizedError } from "../src/errors.js";
import { PermissionGate } from "../src/auth/permissions.js";
import { cleanup, tempRoot, write } from "./helpers.js";

const roots: string[] = [];

afterEach(async () => {
  resetCurrentApp();
  await Promise.all(roots.splice(0).map((root) => cleanup(root)));
});

describe("permissions", () => {
  it("expands roles and wildcard grants", () => {
    const gate = new PermissionGate();
    gate.role("admin", ["*"]);
    gate.role("member", ["user.read", "billing.*"]);

    expect(gate.can({ id: "1", roles: ["member"] }, "user.read")).toBe(true);
    expect(gate.can({ id: "1", roles: ["member"] }, "billing.refund")).toBe(true);
    expect(gate.can({ id: "1", roles: ["member"] }, "admin.delete")).toBe(false);
    expect(gate.can({ id: "1", roles: ["admin"] }, "admin.delete")).toBe(true);
    expect(() => gate.assert(undefined, "user.read")).toThrow(UnauthorizedError);
    expect(() => gate.assert({ id: "1", roles: ["member"] }, "admin.delete")).toThrow(ForbiddenError);
  });

  it("protects routes from config roles", async () => {
    const root = await tempRoot();
    roots.push(root);

    await write(
      root,
      "config/permissions.js",
      `export default { roles: { admin: ['users.read'] } };`
    );
    await write(
      root,
      "modules/users/routes.js",
      `
        export default function (_http, router) {
          const app = arguments[0].get?.('kinara');
        }
      `
    );
    await write(
      root,
      "modules/users/routes.js",
      `
        export default (http, router) => {
          const kinara = http.get('kinara');
          router.get('/users', (req, res, next) => {
            req.actor = req.headers['x-role'] === 'admin'
              ? { id: '1', roles: ['admin'] }
              : { id: '2', roles: ['guest'] };
            next();
          }, kinara.permissions.authorize('users.read'), (_req, res) => {
            res.json({ ok: true, data: [] });
          });
        };
      `
    );

    const app = await createApp({ root, quiet: true });
    const denied = await request(app.http!).get("/users");
    expect(denied.status).toBe(403);
    expect(denied.body.ok).toBe(false);
    expect(denied.body.error.code).toBe("FORBIDDEN");

    const allowed = await request(app.http!).get("/users").set("x-role", "admin");
    expect(allowed.status).toBe(200);
    expect(allowed.body.ok).toBe(true);
    await app.close();
  });
});
