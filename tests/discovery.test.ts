import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp, resetCurrentApp } from "../src/app.js";
import { cleanup, tempRoot, write } from "./helpers.js";

const roots: string[] = [];

afterEach(async () => {
  resetCurrentApp();
  await Promise.all(roots.splice(0).map((root) => cleanup(root)));
});

describe("copy a folder and it works", () => {
  it("auto-loads hooks and routes from modules/<module>", async () => {
    const root = await tempRoot();
    roots.push(root);

    await write(
      root,
      "modules/demo/hooks/log-user-signup.js",
      `
        export default {
          meta() { return { id: 'log-user-signup', name: 'Log user signup' }; },
          listenTo() { return ['user.created']; },
          async handle(payload, ctx) {
            ctx.app.container.instance('lastUser', payload);
          }
        };
      `
    );

    await write(
      root,
      "modules/demo/routes.js",
      `
        export default (http, router) => {
          router.post('/signup', async (req, res) => {
            const payload = { id: 1, email: 'ada@yalu.dev' };
            await req.app.get('kinara').emit('user.created', payload);
            res.json({ ok: true, data: payload });
          });
        };
      `
    );

    const app = await createApp({ root, quiet: true });

    expect(app.hooks.ids()).toContain("log-user-signup");

    const res = await request(app.http!).post("/signup");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(app.make("lastUser")).toEqual({ id: 1, email: "ada@yalu.dev" });

    await app.close();
  });

  it("loads class-style hooks from hooks/", async () => {
    const root = await tempRoot();
    roots.push(root);

    await write(
      root,
      "modules/billing/hooks/flag-invoice.js",
      `
        export default class FlagInvoice {
          meta() { return { id: 'flag-invoice' }; }
          listenTo() { return ['invoice.paid']; }
          handle(payload, ctx) {
            ctx.app.container.instance('invoice', payload);
          }
        }
      `
    );

    const app = await createApp({ root, quiet: true });
    await app.emit("invoice.paid", { total: 42 });
    expect(app.make("invoice")).toEqual({ total: 42 });
    await app.close();
  });
});
