import fs from "node:fs/promises";
import path from "node:path";
import { ConfigRepository } from "./repository.js";
import { exportValue, importModule } from "../discovery/scan.js";

const CONFIG_EXT = new Set([".js", ".mjs", ".cjs", ".ts", ".json"]);

export async function loadConfig(root: string, configDir = "config"): Promise<ConfigRepository> {
  const repo = new ConfigRepository();
  const dir = path.join(root, configDir);

  let files: string[] = [];
  try {
    files = await fs.readdir(dir);
  } catch {
    repo.set("app", { modulesDir: "modules" });
    repo.set("events", { driver: "memory" });
    repo.set("middleware", { global: [], named: {} });
    return repo;
  }

  for (const file of files) {
    const ext = path.extname(file);
    if (!CONFIG_EXT.has(ext) || file.endsWith(".d.ts")) continue;

    const full = path.join(dir, file);
    const name = path.basename(file, ext);
    let data: unknown;

    if (ext === ".json") {
      data = JSON.parse(await fs.readFile(full, "utf8"));
    } else {
      data = exportValue(await importModule(full));
    }

    if (data && typeof data === "object") {
      repo.set(name, data);
    }
  }

  if (!repo.has("app")) {
    repo.set("app", { modulesDir: "modules" });
  }
  if (!repo.has("events")) {
    repo.set("events", { driver: "memory" });
  }

  return repo;
}
