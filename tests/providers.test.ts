import { afterEach, describe, expect, it } from "vitest";
import { createApp, resetCurrentApp } from "../src/app.js";
import type { Kinara } from "../src/app.js";
import type { ServiceProvider } from "../src/types.js";
import { cleanup, tempRoot, write } from "./helpers.js";

const roots: string[] = [];

afterEach(async () => {
  resetCurrentApp();
  await Promise.all(roots.splice(0).map((root) => cleanup(root)));
});

describe("module providers", () => {
  it("registers and boots providers from modules/<module>/providers", async () => {
    const root = await tempRoot();
    roots.push(root);

    await write(
      root,
      "modules/demo/providers/greeting.js",
      `
        export default class GreetingProvider {
          constructor(app) { this.app = app; }
          register(app) { app.container.instance('greeting', 'hello'); }
          boot(app) { app.container.instance('booted', true); }
        }
      `
    );

    const app = await createApp({ root, quiet: true });
    expect(app.make("greeting")).toBe("hello");
    expect(app.make("booted")).toBe(true);
    await app.close();
  });

  it("accepts extra providers in createApp()", async () => {
    const root = await tempRoot();
    roots.push(root);

    class Extra implements ServiceProvider {
      register(app: Kinara) {
        app.container.instance("extra", 1);
      }
    }

    const app = await createApp({ root, quiet: true, providers: [Extra] });
    expect(app.make("extra")).toBe(1);
    await app.close();
  });
});
