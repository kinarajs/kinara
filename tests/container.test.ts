import { describe, expect, it } from "vitest";
import { Container } from "../src/container.js";
import { UnboundServiceError } from "../src/errors.js";

describe("container", () => {
  it("binds and resolves a factory each time until cached by make", () => {
    const container = new Container();
    let calls = 0;
    container.bind("n", () => {
      calls += 1;
      return calls;
    });
    expect(container.make("n")).toBe(1);
    expect(container.make("n")).toBe(1);
  });

  it("stores an instance and reports bound keys", () => {
    const container = new Container();
    container.instance("cfg", { ok: true });
    expect(container.bound("cfg")).toBe(true);
    expect(container.make("cfg")).toEqual({ ok: true });
  });

  it("singleton caches the first resolver result", () => {
    const container = new Container();
    container.singleton("now", () => ({ n: Math.random() }));
    expect(container.make("now")).toBe(container.make("now"));
  });

  it("throws for missing services", () => {
    const container = new Container();
    expect(() => container.make("missing")).toThrow(UnboundServiceError);
  });
});
