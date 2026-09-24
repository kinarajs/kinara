import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { MemcachedCache } from "../src/cache/manager.js";
import {
  decryptVersioned,
  encryptVersioned,
  isVersionedCipher,
} from "../src/crypto/fields.js";
import { ExceptionHandler } from "../src/exceptions/handler.js";
import { toKinaraError, ValidationError } from "../src/errors.js";
import { unaryCall } from "../src/grpc/client.js";
import { defineLogHook } from "../src/hooks/define.js";
import { cors } from "../src/http/cors.js";
import { cookies } from "../src/http/cookies.js";
import { legacyOk } from "../src/http/response.js";
import { validate } from "../src/http/validate.js";
import { asLogExtra, createLogger } from "../src/logger.js";
import { boot, createApp, resetCurrentApp } from "../src/index.js";
import { cleanup, tempRoot, write } from "./helpers.js";

const roots: string[] = [];

afterEach(async () => {
  resetCurrentApp();
  await Promise.all(roots.splice(0).map((root) => cleanup(root)));
});

describe("service gaps", () => {
  it("accepts unknown logger payloads", () => {
    expect(asLogExtra({ port: 1 })).toEqual({ port: 1 });
    expect(asLogExtra("started")).toEqual({ value: "started" });
    const lines: unknown[] = [];
    const logger = createLogger({
      quiet: false,
      sinks: [{ write(record) { lines.push(record.extra); } }],
    });
    logger.info("auth", { port: 5001 });
    expect(lines[0]).toEqual({ port: 5001 });
  });

  it("defineLogHook logs the event payload", async () => {
    const lines: unknown[] = [];
    const hook = defineLogHook("log-auth", "auth.started");
    await hook.handle({ port: 1 }, {
      event: "auth.started",
      app: { logger: { info(_message: string, extra: unknown) { lines.push(extra); } } },
    } as never);
    expect(hook.meta().id).toBe("log-auth");
    expect(lines).toEqual([{ port: 1 }]);
  });

  it("renders the legacy auth error body", () => {
    const handler = new ExceptionHandler();
    handler.responseStyle = "legacy";
    const validation = handler.render(new ValidationError("bad email", { email: "required" }));
    expect(validation.status).toBe(422);
    expect(validation.body).toEqual({
      success: false,
      code: 422,
      name: "ValidationException",
      errors: { email: "required" },
    });

    const duplicate = toKinaraError({ code: 11000, keyPattern: { email: 1 } });
    expect(handler.render(duplicate).body).toMatchObject({
      name: "ValidationException",
      errors: { email: "record with this email already exists." },
    });

    const mongoose = toKinaraError({
      name: "ValidationError",
      errors: { mobile: { properties: { message: "Invalid mobile number" } } },
    });
    expect(handler.render(mongoose).body).toMatchObject({
      errors: { mobile: "Invalid mobile number" },
    });

    const hidden = handler.render(new Error("db down"), "production");
    expect(hidden.body).toEqual({ success: false, msg: "something went wrong" });
  });

  it("validate() throws a field map from a Yup-shaped schema", async () => {
    await expect(validate({
      async validate() {
        const error = new Error("invalid") as Error & { inner: Array<{ path: string; errors: string[] }> };
        error.inner = [{ path: "mobile", errors: ["Invalid mobile number"] }];
        throw error;
      },
    }, {})).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: { mobile: "Invalid mobile number" },
    });
  });

  it("round-trips versioned AES-GCM ciphertext", () => {
    const ring = { active: "1", keys: { "1": "test-key" } };
    const token = encryptVersioned("0712345678", ring);
    expect(isVersionedCipher(token)).toBe(true);
    expect(token.startsWith("v1:")).toBe(true);
    expect(decryptVersioned(token, ring)).toBe("0712345678");
  });

  it("stores values on a memcached-shaped client", async () => {
    const store = new Map<string, unknown>();
    const cache = new MemcachedCache({
      get(key, cb) { cb(null, store.get(key)); },
      set(key, value, _ttl, cb) { store.set(key, value); cb(null); },
      del(key, cb) { store.delete(key); cb(null); },
    });
    await cache.set("otp", "1234", 1500);
    expect(await cache.get("otp")).toBe("1234");
    await cache.del("otp");
    expect(await cache.get("otp")).toBeUndefined();
  });

  it("promisifies a unary gRPC call", async () => {
    const client = {
      SendSms(_request: unknown, cb: (err: Error | null, response?: unknown) => void) {
        cb(null, { success: true });
      },
    };
    await expect(unaryCall(client, "SendSms", { to: "94" })).resolves.toEqual({ success: true });
    await expect(unaryCall(client, "Missing")).rejects.toMatchObject({ code: "GRPC_METHOD_MISSING" });
  });

  it("applies cors and cookies", async () => {
    const http = express();
    http.use(cors({ origin: ["http://localhost:3000"], credentials: true, exposedHeaders: ["X-API-Version"] }));
    http.use(cookies());
    http.get("/me", (req, res) => {
      res.json({ session: req.cookies?.session });
    });
    const res = await request(http)
      .get("/me")
      .set("Origin", "http://localhost:3000")
      .set("Cookie", "session=abc");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect(res.body.session).toBe("abc");
  });

  it("legacyOk spreads the payload", () => {
    expect(legacyOk({ user: "ada" })).toEqual({ success: true, user: "ada" });
  });

  it("boots, emits the started event, and skips signal handlers", async () => {
    const root = await tempRoot();
    roots.push(root);
    await write(root, "modules/demo/routes.ts", "export default () => {};\n");
    const seen: string[] = [];
    const kinara = await boot({
      root,
      quiet: true,
      serviceName: "demo-service",
      port: 0,
      mongo: false,
      signals: false,
      async onReady(app) {
        await app.events.on("demo-service.started", () => {
          seen.push("started");
        });
      },
    });
    expect(seen).toEqual(["started"]);
    await kinara.close();
  });

  it("renders legacy errors from createApp", async () => {
    const root = await tempRoot();
    roots.push(root);
    await write(
      root,
      "modules/demo/routes.ts",
      `
        export default (_http, router) => {
          router.get("/bad", (_req, _res, next) => {
            next(Object.assign(new Error("Invalid mobile number"), {
              success: false,
              code: 422,
              name: "validationException",
              errors: "Invalid mobile number",
            }));
          });
        };
      `
    );
    const app = await createApp({ root, quiet: true, responses: "legacy" });
    app.finalizeHttp();
    const res = await request(app.http!).get("/bad");
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      success: false,
      code: 422,
      name: "validationException",
      errors: "Invalid mobile number",
    });
    await app.close();
  });
});
