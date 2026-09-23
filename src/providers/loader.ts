import path from "node:path";
import type { Kinara } from "../app.js";
import { exportValue, importModule, listCodeFiles, listDirectories } from "../discovery/scan.js";
import type { ServiceProvider } from "../types.js";

export async function loadModuleProviders(app: Kinara, modulesDir: string): Promise<ServiceProvider[]> {
  const modules = await listDirectories(app.root, modulesDir);
  const providers: ServiceProvider[] = [];

  for (const moduleName of modules) {
    const dir = path.join(app.root, modulesDir, moduleName, "providers");
    const files = await listCodeFiles(dir);

    for (const file of files) {
      const exported = exportValue(await importModule(file));
      const provider = instantiateProvider(exported, app);
      if (provider) providers.push(provider);
    }
  }

  return providers;
}

function instantiateProvider(exported: unknown, app: Kinara): ServiceProvider | null {
  if (!exported) return null;

  if (typeof exported === "function") {
    try {
      return new (exported as new (app: Kinara) => ServiceProvider)(app);
    } catch {
      return exported as ServiceProvider;
    }
  }

  if (typeof exported === "object") {
    return exported as ServiceProvider;
  }

  return null;
}
