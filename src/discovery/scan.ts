import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CODE_EXT = new Set([".js", ".mjs", ".cjs", ".ts"]);

export async function listDirectories(root: string, relative = ""): Promise<string[]> {
  const target = path.join(root, relative);
  try {
    const entries = await fs.readdir(target, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listCodeFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && CODE_EXT.has(path.extname(entry.name)))
      .filter((entry) => !entry.name.endsWith(".d.ts") && !entry.name.endsWith(".test.ts"))
      .map((entry) => path.join(dir, entry.name));
  } catch {
    return [];
  }
}

export async function importModule(filePath: string): Promise<unknown> {
  const url = pathToFileURL(filePath).href;
  return import(url);
}

export function exportValue(mod: unknown): unknown {
  if (!mod || typeof mod !== "object") return mod;
  const record = mod as Record<string, unknown>;
  if ("default" in record) return record.default;
  return mod;
}

export async function firstExisting(root: string, names: string[]): Promise<string | null> {
  for (const name of names) {
    const full = path.join(root, name);
    if (await fileExists(full)) return full;
  }
  return null;
}
