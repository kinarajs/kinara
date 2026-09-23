import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalStorageDriver, MemoryStorageDriver } from "../src/storage/local.js";
import { StorageManager } from "../src/storage/manager.js";
import { PathEscapeError } from "../src/errors.js";
import { cleanup, tempRoot } from "./helpers.js";

describe("local storage", () => {
  it("writes, reads, lists, and deletes files", async () => {
    const root = await tempRoot();
    const disk = new LocalStorageDriver(root);
    try {
      await disk.write("data/hello.txt", "Hello");
      expect(await disk.exists("data/hello.txt")).toBe(true);
      expect(await disk.read("data/hello.txt")).toBe("Hello");
      expect(await disk.list("data")).toContain("hello.txt");
      expect(await disk.isDirectory("data")).toBe(true);
      await disk.delete("data/hello.txt");
      expect(await disk.exists("data/hello.txt")).toBe(false);
    } finally {
      await cleanup(root);
    }
  });

  it("blocks path traversal", async () => {
    const root = await tempRoot();
    const disk = new LocalStorageDriver(root);
    try {
      await expect(disk.read("../secret.txt")).rejects.toBeInstanceOf(PathEscapeError);
      await expect(disk.write(path.join("..", "secret.txt"), "x")).rejects.toBeInstanceOf(
        PathEscapeError
      );
    } finally {
      await cleanup(root);
    }
  });
});

describe("memory storage + manager", () => {
  it("round-trips in memory and resolves named disks", async () => {
    const memory = new MemoryStorageDriver();
    await memory.write("notes/a.txt", "n");
    expect(await memory.read("notes/a.txt")).toBe("n");
    expect(await memory.list("notes")).toEqual(["a.txt"]);

    const manager = new StorageManager().register("memory", memory, true);
    expect(manager.disk().exists("notes/a.txt")).toBeTruthy();
    await expect(manager.disk("memory").read("notes/a.txt")).resolves.toBe("n");
    expect(() => manager.disk("s3")).toThrow(/not configured/);
  });
});
