import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp, resetCurrentApp } from "../src/app.js";
import { cleanup, tempRoot, write } from "./helpers.js";

const roots: string[] = [];

afterEach(async () => {
  resetCurrentApp();
  await Promise.all(roots.splice(0).map((root) => cleanup(root)));
});

describe("rate limiting", () => {
  it("can be activated from config", async () => {
    const root = await tempRoot();
    roots.push(root);
    await write(root, "config/rateLimit.js", `export default { enabled: true, max: 2, windowMs: 5000 };`);
    await write(
      root,
      "modules/demo/routes.js",
      `export default (_http, router) => { router.get('/ping', (_req, res) => res.json({ ok: true, data: 'pong' })); };`
    );

    const app = await createApp({ root, quiet: true, mode: "development" });
    app.finalizeHttp();
    expect((await request(app.http!).get("/ping")).status).toBe(200);
    expect((await request(app.http!).get("/ping")).status).toBe(200);
    const limited = await request(app.http!).get("/ping");
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
    await app.close();
  });
});
