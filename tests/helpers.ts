import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resetCurrentApp } from "../src/app.js";

export async function tempRoot(prefix = "kinara-"): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
  return root;
}

export async function write(root: string, relative: string, contents: string): Promise<string> {
  const full = path.join(root, relative);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, contents);
  return full;
}

export async function cleanup(root: string): Promise<void> {
  resetCurrentApp();
  await fs.rm(root, { recursive: true, force: true });
}
