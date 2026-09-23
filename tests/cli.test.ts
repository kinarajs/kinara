import { afterEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { runCli } from "../src/cli/index.js";
import { cleanup, tempRoot } from "./helpers.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => cleanup(root)));
});

function capture() {
  let out = "";
  return {
    stdout: { write: (chunk: string) => (out += chunk) },
    text: () => out,
  };
}

describe("laravel-style CLI", () => {
  it("lists artisan-like commands", async () => {
    const io = capture();
    const code = await runCli(["list"], { stdout: io.stdout, cwd: process.cwd() });
    expect(code).toBe(0);
    expect(io.text()).toContain("make:hook");
    expect(io.text()).toContain("make:model");
    expect(io.text()).toContain("key:generate");
    expect(io.text()).toContain("serve");
  });

  it("creates a service with new", async () => {
    const root = await tempRoot();
    roots.push(root);
    const io = capture();
    const code = await runCli(["new", "billing"], { cwd: root, stdout: io.stdout });
    expect(code).toBe(0);
    const pkg = JSON.parse(await readFile(path.join(root, "billing/package.json"), "utf8"));
    expect(pkg.scripts.dev).toBe("kinara serve");
    expect(await readFile(path.join(root, "billing/src/modules/demo/hooks/log-user-signup.ts"), "utf8")).toContain(
      "defineHook"
    );
  });

  it("scaffolds make:* files", async () => {
    const root = await tempRoot();
    roots.push(root);
    const io = capture();
    expect(await runCli(["make:module", "users"], { cwd: root, stdout: io.stdout })).toBe(0);
    expect(await runCli(["make:hook", "users", "log-created", "user.created"], { cwd: root, stdout: io.stdout })).toBe(
      0
    );
    expect(await runCli(["make:model", "user"], { cwd: root, stdout: io.stdout })).toBe(0);
    expect(await runCli(["make:middleware", "auth"], { cwd: root, stdout: io.stdout })).toBe(0);
    expect(await runCli(["make:provider", "users", "directory"], { cwd: root, stdout: io.stdout })).toBe(0);
    expect(await runCli(["make:rpc", "users", "UserService"], { cwd: root, stdout: io.stdout })).toBe(0);
    expect(await runCli(["make:seeder", "users"], { cwd: root, stdout: io.stdout })).toBe(0);
    expect(await readFile(path.join(root, "src/modules/users/hooks/log-created.ts"), "utf8")).toContain("user.created");
    expect(await readFile(path.join(root, "src/models/user.ts"), "utf8")).toContain("defineModel");
    expect(await runCli(["route:list"], { cwd: root, stdout: io.stdout })).toBe(0);
    expect(io.text()).toContain("users");
  });

  it("generates an encryption key", async () => {
    const io = capture();
    await runCli(["key:generate"], { stdout: io.stdout, cwd: process.cwd() });
    expect(io.text()).toMatch(/^KINARA_KEY=/);
  });

  it("supports generate aliases, create, and cache:clear", async () => {
    const root = await tempRoot();
    roots.push(root);
    const io = capture();
    expect(await runCli(["create", "demo-svc"], { cwd: root, stdout: io.stdout })).toBe(0);
    expect(await runCli(["generate", "module", "orders"], { cwd: root, stdout: io.stdout })).toBe(0);
    expect(await runCli(["generate", "hook", "orders", "flag", "order.paid"], { cwd: root, stdout: io.stdout })).toBe(
      0
    );
    expect(await runCli(["cache:clear"], { cwd: root, stdout: io.stdout })).toBe(0);
    expect(io.text()).toContain("In-memory cache");
    expect(await readFile(path.join(root, "src/modules/orders/hooks/flag.ts"), "utf8")).toContain("order.paid");
  });

  it("serve and start spawn the expected processes", async () => {
    const spawned: Array<{ bin: string; args: string[] }> = [];
    const io = capture();
    await runCli(["serve"], {
      cwd: process.cwd(),
      stdout: io.stdout,
      spawn: (bin, args) => spawned.push({ bin, args }),
    });
    await runCli(["start"], {
      cwd: process.cwd(),
      stdout: io.stdout,
      spawn: (bin, args) => spawned.push({ bin, args }),
    });
    expect(spawned[0]).toEqual({ bin: "npx", args: ["tsx", "watch", "src/index.ts"] });
    expect(spawned[1]).toEqual({ bin: "node", args: ["dist/index.js"] });
  });

  it("returns usage errors", async () => {
    const io = capture();
    const code = await runCli(["make:hook"], { stdout: io.stdout, cwd: process.cwd() });
    expect(code).toBe(1);
    expect(io.text()).toContain("usage:");
  });
});
