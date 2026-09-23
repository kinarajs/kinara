import { KinaraError } from "../errors.js";
import { LocalStorageDriver, MemoryStorageDriver, type StorageDriver } from "./local.js";

export class StorageManager {
  private readonly disks = new Map<string, StorageDriver>();
  private defaultDisk = "local";

  disk(name?: string): StorageDriver {
    const key = name || this.defaultDisk;
    const driver = this.disks.get(key);
    if (!driver) {
      throw new KinaraError(`Disk '${key}' is not configured.`, { code: "UNKNOWN_DISK" });
    }
    return driver;
  }

  register(name: string, driver: StorageDriver, asDefault = false): this {
    this.disks.set(name, driver);
    if (asDefault) this.defaultDisk = name;
    return this;
  }

  static createDefault(root: string): StorageManager {
    return new StorageManager()
      .register("local", new LocalStorageDriver(root), true)
      .register("memory", new MemoryStorageDriver());
  }
}
