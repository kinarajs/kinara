import { describe, expect, it } from "vitest";
import { BaseHook, defineAction, defineHook, isHook } from "../src/hooks/define.js";
import { EventBus } from "../src/events/bus.js";
import { HookRegistry } from "../src/hooks/registry.js";
import { createLogger } from "../src/logger.js";
import type { HookContext } from "../src/types.js";

describe("defineHook / defineAction", () => {
  it("creates a hook from a definition", async () => {
    const seen: unknown[] = [];
    const hook = defineHook({
      id: "log-user-signup",
      name: "Log user signup",
      on: "user.created",
      handle(payload) {
        seen.push(payload);
      },
    });

    expect(isHook(hook)).toBe(true);
    expect(hook.meta()).toEqual({ id: "log-user-signup", name: "Log user signup" });
    expect(hook.listenTo()).toEqual(["user.created"]);
    await hook.handle({ email: "a@b.c" }, { event: "user.created", app: {} as never });
    expect(seen).toEqual([{ email: "a@b.c" }]);
  });

  it("defineAction is an alias of defineHook", () => {
    expect(defineAction).toBe(defineHook);
  });

  it("supports the class style from the original framework", async () => {
    class LogUserSignup extends BaseHook<{ id: number }> {
      meta() {
        return { id: "log-user-signup", name: "Log user signup" };
      }
      listenTo() {
        return ["user.created"];
      }
      async handle(payload: { id: number }, _ctx: HookContext) {
        expect(payload.id).toBe(7);
      }
    }

    const hook = new LogUserSignup();
    expect(hook.listenTo()).toEqual(["user.created"]);
    await hook.handle({ id: 7 }, { event: "user.created", app: {} as never });
  });
});

describe("hook registry", () => {
  it("subscribes hooks to the event bus", async () => {
    const events = new EventBus();
    const registry = new HookRegistry(events, createLogger({ quiet: true }));
    const seen: string[] = [];

    await registry.register(
      defineHook({
        id: "a",
        on: ["user.created", "user.verified"],
        handle(_payload, ctx: HookContext) {
          seen.push(ctx.event);
        },
      }),
      () => ({ app: {} as never })
    );

    await events.emit("user.created", {});
    await events.emit("user.verified", {});
    expect(registry.ids()).toEqual(["a"]);
    expect(seen).toEqual(["user.created", "user.verified"]);
    await events.close();
  });
});
