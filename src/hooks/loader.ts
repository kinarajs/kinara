import path from "node:path";
import type { Kinara } from "../app.js";
import { exportValue, importModule, listCodeFiles, listDirectories } from "../discovery/scan.js";
import { isHook, wrapClassHook } from "./define.js";
import type { Hook } from "../types.js";

export async function loadHooks(app: Kinara, modulesDir: string): Promise<number> {
  const modules = await listDirectories(app.root, modulesDir);
  let loaded = 0;

  for (const moduleName of modules) {
    const hookDir = path.join(app.root, modulesDir, moduleName, "hooks");
    const files = await listCodeFiles(hookDir);

    for (const file of files) {
      const hook = await instantiateHook(file);
      if (!hook) {
        app.logger.warn(`ignored ${path.relative(app.root, file)} — not a hook`);
        continue;
      }
      await app.hooks.register(hook, () => ({ app }));
      loaded += 1;
    }
  }

  return loaded;
}

async function instantiateHook(file: string): Promise<Hook | null> {
  const mod = exportValue(await importModule(file));
  const fallbackId = path.basename(file, path.extname(file));

  if (isHook(mod)) return ensureMeta(mod, fallbackId);

  if (typeof mod === "function") {
    try {
      const instance = wrapClassHook(mod as new () => Hook, fallbackId);
      if (instance) return instance;
    } catch {
      return null;
    }
  }

  return null;
}

function ensureMeta(hook: Hook, fallbackId: string): Hook {
  if (typeof hook.meta === "function") return hook;
  hook.meta = () => ({ id: fallbackId, name: fallbackId });
  return hook;
}
