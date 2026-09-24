import { describe, expect, it } from "vitest";
import { EventBus } from "../src/events/bus.js";
import { MemoryEventDriver } from "../src/events/drivers/memory.js";
import { InvalidEventNameError, UnknownDriverError } from "../src/errors.js";
import type { EventDriver, EventListener } from "../src/types.js";

describe("memory event bus", () => {
  it("delivers sanitized payloads to listeners", async () => {
    const bus = new EventBus();
    const seen: unknown[] = [];
    await bus.on("user.created", (payload) => {
      seen.push(payload);
    });
    await bus.emit("user.created", { id: 1, name: "Ada" });
    expect(seen).toEqual([{ id: 1, name: "Ada" }]);
    await bus.close();
  });

  it("supports wildcard listeners", async () => {
    const bus = new EventBus();
    const names: string[] = [];
    await bus.on("user.*", (_payload, event) => {
      names.push(event);
    });
    await bus.emit("user.created", {});
    await bus.emit("user.updated", {});
    await bus.emit("billing.paid", {});
    expect(names).toEqual(["user.created", "user.updated"]);
    await bus.close();
  });

  it("isolates listener failures", async () => {
    const bus = new EventBus();
    const seen: string[] = [];
    await bus.on("order.paid", () => {
      throw new Error("boom");
    });
    await bus.on("order.paid", () => {
      seen.push("ok");
    });
    await bus.emit("order.paid", { id: 9 });
    expect(seen).toEqual(["ok"]);
    await bus.close();
  });

  it("emitSafe does not throw on listener or name errors", async () => {
    const bus = new EventBus();
    await bus.on("order.failed", () => {
      throw new Error("listener");
    });
    await expect(bus.emitSafe("order.failed", { id: 1 })).resolves.toBe(bus);
    await expect(bus.emitSafe("not a valid name", {})).resolves.toBe(bus);
    await bus.close();
  });

  it("rejects unsafe event names", async () => {
    const bus = new EventBus();
    await expect(bus.emit("../etc/passwd", {})).rejects.toBeInstanceOf(InvalidEventNameError);
    await expect(bus.on("has spaces", () => undefined)).rejects.toBeInstanceOf(
      InvalidEventNameError
    );
    await bus.close();
  });

  it("strips prototype pollution from payloads", async () => {
    const bus = new EventBus();
    const seen: Array<Record<string, unknown>> = [];
    await bus.on("sec.test", (payload) => {
      seen.push(payload as Record<string, unknown>);
    });
    await bus.emit("sec.test", JSON.parse('{"ok":true,"__proto__":{"polluted":true}}'));
    expect(seen[0]?.ok).toBe(true);
    expect(Object.prototype).not.toHaveProperty("polluted");
    await bus.close();
  });
});

describe("event drivers", () => {
  it("throws for unknown drivers", async () => {
    const bus = new EventBus();
    await expect(bus.use("kafka")).rejects.toBeInstanceOf(UnknownDriverError);
  });

  it("swaps in a custom driver", async () => {
    const emitted: Array<{ event: string; payload: unknown }> = [];

    class FakeDriver implements EventDriver {
      readonly name = "fake";
      async on() {}
      async off() {}
      async emit(event: string, payload: unknown) {
        emitted.push({ event, payload });
      }
    }

    const bus = new EventBus();
    bus.registerDriver("fake", () => new FakeDriver());
    await bus.use("fake");
    await bus.emit("ping.ok", { n: 1 });
    expect(bus.driverName()).toBe("fake");
    expect(emitted).toEqual([{ event: "ping.ok", payload: { n: 1 } }]);
    await bus.close();
  });

  it("counts memory listeners", async () => {
    const driver = new MemoryEventDriver();
    const listener: EventListener = () => undefined;
    driver.on("a.b", listener);
    expect(driver.listenerCount("a.b")).toBe(1);
    driver.off("a.b", listener);
    expect(driver.listenerCount("a.b")).toBe(0);
    await driver.close();
  });
});
