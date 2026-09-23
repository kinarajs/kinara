import { describe, expect, it } from "vitest";
import { decodeEventBody, sanitizePayload } from "../src/security/payload.js";
import { assertEventName, assertEventPattern, matchesEvent } from "../src/security/event-name.js";
import { resolveSafePath } from "../src/security/path.js";
import { InvalidEventNameError, PathEscapeError } from "../src/errors.js";
import { ValidationError } from "../src/errors.js";

describe("security", () => {
  it("matches event patterns safely", () => {
    expect(matchesEvent("user.created", "user.created")).toBe(true);
    expect(matchesEvent("user.*", "user.created")).toBe(true);
    expect(matchesEvent("user.*", "users.created")).toBe(false);
    expect(matchesEvent("*", "anything")).toBe(true);
  });

  it("accepts only safe event names", () => {
    expect(assertEventName("billing:invoice-paid")).toBe("billing:invoice-paid");
    expect(() => assertEventName("user.*")).toThrow(InvalidEventNameError);
    expect(() => assertEventName("../../../x")).toThrow(InvalidEventNameError);
    expect(() => assertEventName("")).toThrow(InvalidEventNameError);
    expect(assertEventPattern("user.*")).toBe("user.*");
    expect(assertEventPattern("*")).toBe("*");
  });

  it("decodes JSON event bodies", () => {
    expect(decodeEventBody(Buffer.from('{"a":1}'))).toEqual({ a: 1 });
  });

  it("keeps primitives when cloning", () => {
    expect(sanitizePayload(12)).toBe(12);
    expect(sanitizePayload("ok")).toBe("ok");
  });

  it("resolveSafePath stays inside the root", () => {
    expect(resolveSafePath("/tmp/app", "a/b.txt")).toMatch(/a[/\\]b.txt$/);
    expect(() => resolveSafePath("/tmp/app", "../etc/passwd")).toThrow(PathEscapeError);
  });

  it("validation errors carry status 422", () => {
    const error = new ValidationError("invalid email", { field: "email" });
    expect(error.statusCode).toBe(422);
    expect(error.details).toEqual({ field: "email" });
  });
});
