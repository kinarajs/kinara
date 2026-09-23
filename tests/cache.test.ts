import { describe, expect, it } from "vitest";
import { CacheManager, MemoryCache } from "../src/cache/manager.js";

describe("cache", () => {
  it("stores, expires, and wraps", async () => {
    const cache = new CacheManager(new MemoryCache());
    await cache.set("user:1", { id: 1 }, 50);
    expect(await cache.get("user:1")).toEqual({ id: 1 });

    let loads = 0;
    const first = await cache.wrap("user:2", 1000, async () => {
      loads += 1;
      return { id: 2 };
    });
    const second = await cache.wrap("user:2", 1000, async () => {
      loads += 1;
      return { id: 99 };
    });
    expect(first).toEqual({ id: 2 });
    expect(second).toEqual({ id: 2 });
    expect(loads).toBe(1);

    await cache.set("gone", true, 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await cache.get("gone")).toBeUndefined();
    await cache.close();
  });
});
