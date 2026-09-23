import fs from "node:fs/promises";
import path from "node:path";
import { resolveSafePath } from "../security/path.js";

export interface StorageDriver {
  read(filePath: string): Promise<string>;
  write(filePath: string, content: string | Buffer): Promise<void>;
  delete(filePath: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
  list(directoryPath: string): Promise<string[]>;
  isDirectory(directoryPath: string): Promise<boolean>;
}

export class LocalStorageDriver implements StorageDriver {
  constructor(private readonly root: string) {}

  private resolve(filePath: string): string {
    return resolveSafePath(this.root, filePath);
  }

  async read(filePath: string): Promise<string> {
    return fs.readFile(this.resolve(filePath), "utf8");
  }

  async write(filePath: string, content: string | Buffer): Promise<void> {
    const full = this.resolve(filePath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content);
  }

  async delete(filePath: string): Promise<void> {
    await fs.unlink(this.resolve(filePath));
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(filePath));
      return true;
    } catch {
      return false;
    }
  }

  async list(directoryPath: string): Promise<string[]> {
    if (!(await this.isDirectory(directoryPath))) return [];
    return fs.readdir(this.resolve(directoryPath));
  }

  async isDirectory(directoryPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(this.resolve(directoryPath));
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}

export class MemoryStorageDriver implements StorageDriver {
  private readonly files = new Map<string, string>();

  private key(filePath: string): string {
    return filePath.replace(/\\/g, "/").replace(/^\/+/, "");
  }

  async read(filePath: string): Promise<string> {
    const value = this.files.get(this.key(filePath));
    if (value === undefined) throw new Error(`File not found: ${filePath}`);
    return value;
  }

  async write(filePath: string, content: string | Buffer): Promise<void> {
    this.files.set(this.key(filePath), content.toString());
  }

  async delete(filePath: string): Promise<void> {
    this.files.delete(this.key(filePath));
  }

  async exists(filePath: string): Promise<boolean> {
    return this.files.has(this.key(filePath));
  }

  async list(directoryPath: string): Promise<string[]> {
    const prefix = this.key(directoryPath).replace(/\/?$/, "/");
    const names = new Set<string>();
    for (const file of this.files.keys()) {
      if (file.startsWith(prefix)) {
        names.add(file.slice(prefix.length).split("/")[0] ?? "");
      }
    }
    return [...names].filter(Boolean);
  }

  async isDirectory(directoryPath: string): Promise<boolean> {
    const prefix = this.key(directoryPath).replace(/\/?$/, "/");
    for (const file of this.files.keys()) {
      if (file.startsWith(prefix)) return true;
    }
    return false;
  }
}
