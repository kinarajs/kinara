import { describe, expect, it } from "vitest";
import { ConfigRepository } from "../src/config/repository.js";
import { loadConfig } from "../src/config/load.js";
import { cleanup, tempRoot, write } from "./helpers.js";

describe("config repository", () => {
  it("reads nested keys with defaults", () => {
    const config = new ConfigRepository();
    config.set("events", { driver: "memory", rabbitmq: { url: "amqp://local" } });
    expect(config.get("events.driver")).toBe("memory");
    expect(config.get("events.rabbitmq.url")).toBe("amqp://local");
    expect(config.get("events.missing", "fallback")).toBe("fallback");
    expect(config.has("events.driver")).toBe(true);
    expect(config.has("nope")).toBe(false);
  });

  it("merges namespaces", () => {
    const config = new ConfigRepository();
    config.set("app", { http: true });
    config.merge("app", { modulesDir: "modules" });
    expect(config.get("app")).toEqual({ http: true, modulesDir: "modules" });
  });
});

describe("config loader", () => {
  it("loads js and json files from config/", async () => {
    const root = await tempRoot();
    await write(root, "config/app.js", "export default { modulesDir: 'modules' }");
    await write(root, "config/events.json", JSON.stringify({ driver: "memory" }));

    try {
      const config = await loadConfig(root);
      expect(config.get("app.modulesDir")).toBe("modules");
      expect(config.get("events.driver")).toBe("memory");
    } finally {
      await cleanup(root);
    }
  });

  it("uses defaults when config/ is missing", async () => {
    const root = await tempRoot();
    try {
      const config = await loadConfig(root);
      expect(config.get("app.modulesDir")).toBe("modules");
      expect(config.get("events.driver")).toBe("memory");
    } finally {
      await cleanup(root);
    }
  });
});
