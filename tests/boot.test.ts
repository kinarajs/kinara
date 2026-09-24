import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp, emitSafe, resetCurrentApp } from "../src/app.js";
import { EventBus } from "../src/events/bus.js";
import { loadEnv } from "../src/env.js";
import { cleanup, tempRoot, write } from "./helpers.js";

const roots: string[] = [];

afterEach(async () => {
  resetCurrentApp();
  await Promise.all(roots.splice(0).map((root) => cleanup(root)));
});

describe("boot helpers", () => {
  it("serves /health before listen and lets use() register routes after createApp", async () => {
    const root = await tempRoot();
    roots.push(root);
    const app = await createApp({ root, quiet: true, serviceName: "sms", rateLimit: false });

    expect((await request(app.http!).get("/health")).body).toMatchObject({
      ok: true,
      data: { status: "ok", service: "sms" },
    });

    app.use("/ping", (_req, res) => {
      res.json({ ok: true, data: { pong: true } });
    });

    expect((await request(app.http!).get("/ping")).body.data.pong).toBe(true);

    app.finalizeHttp();
    const missing = await request(app.http!).get("/no-such-route");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("NOT_FOUND");
    await app.close();
  });

  it("mounts an existing express app", async () => {
    const root = await tempRoot();
    roots.push(root);
    const express = (await import("express")).default;
    const existing = express();
    existing.get("/legacy", (_req, res) => {
      res.json({ ok: true, data: { legacy: true } });
    });

    const app = await createApp({ root, quiet: true, health: false });
    app.mount(existing);
    expect((await request(app.http!).get("/legacy")).body.data.legacy).toBe(true);
    await app.close();
  });

  it("swallows emitSafe failures", async () => {
    const bus = new EventBus();
    await expect(bus.emitSafe("../not-an-event", { x: 1 })).resolves.toBe(bus);
    await bus.close();
  });

  it("standalone emitSafe is a no-op before boot", async () => {
    resetCurrentApp();
    await expect(emitSafe("sms.sent", { to: "1" })).resolves.toBeUndefined();
  });
});

describe("loadEnv", () => {
  it("loads unset keys from .env and does not overwrite", async () => {
    const root = await tempRoot();
    roots.push(root);
    process.env.KINARA_ENV_KEEP = "existing";
    delete process.env.KINARA_ENV_NEW;
    await write(root, ".env", "KINARA_ENV_NEW=hello\nKINARA_ENV_KEEP=ignored\n");
    expect(loadEnv(root)).toBe(1);
    expect(process.env.KINARA_ENV_NEW).toBe("hello");
    expect(process.env.KINARA_ENV_KEEP).toBe("existing");
    delete process.env.KINARA_ENV_NEW;
    delete process.env.KINARA_ENV_KEEP;
  });
});
