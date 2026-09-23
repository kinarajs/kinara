import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp, resetCurrentApp } from "../src/app.js";
import { handle } from "../src/http/handler.js";
import { sendCreated, sendFail, sendOk } from "../src/http/response.js";
import { createRequestId, getActor, getRequestId, runWithContext, setActor } from "../src/context.js";
import { definePermissions } from "../src/auth/permissions.js";
import { createLogger } from "../src/logger.js";
import { cleanup, tempRoot, write } from "./helpers.js";

const roots: string[] = [];

afterEach(async () => {
  resetCurrentApp();
  await Promise.all(roots.splice(0).map((root) => cleanup(root)));
});

describe("HTTP helpers", () => {
  it("handle + sendOk / sendCreated / sendFail", async () => {
    const root = await tempRoot();
    roots.push(root);
    await write(
      root,
      "modules/demo/routes.js",
      `
        export default (http, router) => {
          router.get("/ok", (req, res) => {
            res.status(200).json({ ok: true, data: { n: 1 } });
          });
          router.post("/created", (req, res) => {
            res.status(201).json({ ok: true, data: { id: "n1" } });
          });
          router.get("/fail", (req, res) => {
            res.status(400).json({ ok: false, error: { code: "BAD_REQUEST", message: "nope" } });
          });
        };
      `
    );
    const app = await createApp({ root, quiet: true });
    expect((await request(app.http!).get("/ok")).body.data.n).toBe(1);
    expect((await request(app.http!).post("/created")).status).toBe(201);
    expect((await request(app.http!).get("/fail")).body.error.code).toBe("BAD_REQUEST");
    expect((await request(app.http!).get("/ok")).headers["x-content-type-options"]).toBe("nosniff");
    await app.close();
  });

  it("exposes handle and response writers", () => {
    const res = {
      statusCode: 0,
      body: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
    };
    sendOk(res as never, { id: 1 });
    expect(res.statusCode).toBe(200);
    sendCreated(res as never, { id: 2 });
    expect(res.statusCode).toBe(201);
    sendFail(res as never, "BAD_REQUEST", "nope", 400);
    expect(res.body).toMatchObject({ ok: false, error: { code: "BAD_REQUEST" } });
    const wrapped = handle(async (_req, response) => {
      sendOk(response, { ok: true });
    });
    expect(typeof wrapped).toBe("function");
  });
});

describe("context, permissions helper, logger", () => {
  it("stores request id and actor", () => {
    const requestId = createRequestId();
    runWithContext({ requestId }, () => {
      expect(getRequestId()).toBe(requestId);
      setActor({ id: "u1", roles: ["admin"] });
      expect(getActor()?.id).toBe("u1");
    });
  });

  it("definePermissions builds a gate", () => {
    const gate = definePermissions({ member: ["user.read"] });
    expect(gate.can({ id: "1", roles: ["member"] }, "user.read")).toBe(true);
  });

  it("logger writes through a custom sink", async () => {
    const lines: string[] = [];
    const logger = createLogger({
      quiet: false,
      json: true,
      sinks: [
        {
          write(record) {
            lines.push(record.message);
          },
        },
      ],
    });
    logger.info("hello");
    logger.warn("careful");
    await logger.flush();
    expect(lines).toEqual(["hello", "careful"]);
  });
});
