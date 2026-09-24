import { describe, expect, it } from "vitest";
import { ExceptionHandler, report, rescue } from "../src/exceptions/handler.js";
import { NotFoundError, ValidationError } from "../src/errors.js";
import { createLogger } from "../src/logger.js";

describe("exception handling", () => {
  it("renders envelopes and hides 5xx in production", async () => {
    const handler = new ExceptionHandler(createLogger({ quiet: true }));
    const client = handler.render(new ValidationError("bad email", { field: "email" }), "production");
    expect(client.status).toBe(422);
    expect((client.body.error as { message: string }).message).toBe("bad email");

    const boom = await handler.report(new Error("secret stack"));
    const hidden = handler.render(boom, "production");
    expect(hidden.status).toBe(500);
    expect((hidden.body.error as { message: string }).message).toBe("Internal server error");
  });

  it("does not report expected client errors", async () => {
    const seen: string[] = [];
    const handler = new ExceptionHandler(createLogger({ quiet: true }));
    handler.reportUsing((error) => {
      seen.push(error.code);
    });
    await handler.report(new NotFoundError("User"));
    expect(seen).toEqual([]);
    await handler.report(new Error("db down"));
    expect(seen).toEqual(["INTERNAL_ERROR"]);
  });

  it("report() maps unknown values", async () => {
    const mapped = await report("boom");
    expect(mapped.code).toBe("INTERNAL_ERROR");
    expect(mapped.expose).toBe(false);
  });

  it("rescue returns a fallback", async () => {
    const value = await rescue(async () => {
      throw new Error("nope");
    }, 7);
    expect(value).toBe(7);
  });
});
