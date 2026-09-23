import { describe, expect, it } from "vitest";
import { isDevelopment, isProduction, isTest, resolveMode } from "../src/runtime.js";
import { useTelemetry, withSpan } from "../src/telemetry/otel.js";

describe("runtime", () => {
  it("normalizes environments", () => {
    expect(resolveMode("prod")).toBe("production");
    expect(resolveMode("test")).toBe("test");
    expect(isProduction("production")).toBe(true);
    expect(isDevelopment("development")).toBe(true);
    expect(isTest("test")).toBe(true);
  });
});

describe("telemetry adapter", () => {
  it("accepts any otel-shaped adapter", async () => {
    const ended: string[] = [];
    useTelemetry({
      getTracer: () => ({
        startSpan: (name) => ({
          end: () => ended.push(name),
        }),
      }),
    });
    const value = await withSpan("billing.charge", async () => 9);
    expect(value).toBe(9);
    expect(ended).toEqual(["billing.charge"]);
  });
});
