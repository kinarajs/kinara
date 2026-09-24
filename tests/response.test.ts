import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp, resetCurrentApp } from "../src/app.js";
import { fail, ok, paginated } from "../src/http/response.js";
import { cleanup, tempRoot, write } from "./helpers.js";

const roots: string[] = [];

afterEach(async () => {
  resetCurrentApp();
  await Promise.all(roots.splice(0).map((root) => cleanup(root)));
});

describe("response envelopes", () => {
  it("builds success and error payloads", () => {
    expect(ok({ id: 1 })).toEqual({ ok: true, data: { id: 1 } });
    expect(fail("BAD_REQUEST", "nope", { field: "email" })).toEqual({
      ok: false,
      error: { code: "BAD_REQUEST", message: "nope", details: { field: "email" } },
    });
    expect(paginated([1], { page: 1, pageSize: 10, total: 1 }).meta).toMatchObject({
      pages: 1,
      total: 1,
    });
  });

  it("turns thrown errors into envelopes", async () => {
    const root = await tempRoot();
    roots.push(root);
    await write(
      root,
      "modules/demo/routes.js",
      `
        export default (_http, router) => {
          router.get('/missing', (_req, _res, next) => {
            const error = new Error('User not found');
            error.name = 'NotFoundError';
            error.code = 'NOT_FOUND';
            error.statusCode = 404;
            error.expose = true;
            next(error);
          });
        };
      `
    );

    const app = await createApp({ root, quiet: true });
    app.finalizeHttp();
    const missing = await request(app.http!).get("/missing");
    expect(missing.status).toBe(404);
    expect(missing.body.ok).toBe(false);
    expect(missing.body.error.code).toBe("NOT_FOUND");

    const unknown = await request(app.http!).get("/nope");
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("NOT_FOUND");
    expect(unknown.headers["x-request-id"]).toBeTruthy();
    expect(unknown.headers["x-content-type-options"]).toBe("nosniff");
    await app.close();
  });
});
