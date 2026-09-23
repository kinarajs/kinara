import { afterEach, describe, expect, it } from "vitest";
import { app, createApp, event, resetCurrentApp } from "../src/app.js";
import { NotBootedError } from "../src/errors.js";
import { cleanup, tempRoot } from "./helpers.js";

const roots: string[] = [];

afterEach(async () => {
  resetCurrentApp();
  await Promise.all(roots.splice(0).map((root) => cleanup(root)));
});

describe("createApp", () => {
  it("boots accessors and the default memory bus", async () => {
    const root = await tempRoot();
    roots.push(root);
    const kinara = await createApp({ root, quiet: true });

    expect(app()).toBe(kinara);
    expect(event()).toBe(kinara.events);
    expect(kinara.events.driverName()).toBe("memory");
    expect(kinara.storage.disk("local")).toBeTruthy();
    expect(kinara.http).toBeDefined();
    expect(kinara.cache.driverName()).toBe("memory");
    expect(kinara.exceptions).toBeDefined();
    expect(kinara.ws.size()).toBe(0);
    expect(kinara.permissions).toBeDefined();

    await kinara.close();
  });

  it("throws before boot", () => {
    resetCurrentApp();
    expect(() => app()).toThrow(NotBootedError);
  });
});
