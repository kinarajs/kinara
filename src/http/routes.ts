import path from "node:path";
import type { Kinara } from "../app.js";
import { exportValue, firstExisting, importModule, listDirectories } from "../discovery/scan.js";
import type { RouteRegistrar } from "../types.js";

export async function loadRoutes(app: Kinara, modulesDir: string): Promise<number> {
  const http = app.http;
  const router = app.router;
  if (!http || !router) return 0;

  const modules = await listDirectories(app.root, modulesDir);
  let loaded = 0;

  for (const moduleName of modules) {
    const moduleRoot = path.join(app.root, modulesDir, moduleName);
    const routeFile = await firstExisting(moduleRoot, ["routes.ts", "routes.js", "routes.mjs"]);
    if (!routeFile) continue;

    const registrar = exportValue(await importModule(routeFile));
    if (typeof registrar !== "function") {
      app.logger.warn(`routes in ${moduleName} must export a function`);
      continue;
    }

    await (registrar as RouteRegistrar)(http, router, app.middleware.resolver());
    loaded += 1;
    app.logger.debug(`routes ${moduleName}`);
  }

  http.use(router);
  return loaded;
}
