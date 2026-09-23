import path from "node:path";
import type { Kinara } from "../app.js";
import { exportValue, importModule } from "../discovery/scan.js";
import type { MiddlewareFactory, MiddlewareFn } from "../types.js";

export async function loadNamedMiddleware(app: Kinara): Promise<void> {
  const named = app.config.get<Record<string, string>>("middleware.named", {});
  const global = app.config.get<string[]>("middleware.global", []);

  for (const [name, relative] of Object.entries(named ?? {})) {
    const file = path.resolve(app.root, relative);
    const factory = exportValue(await importModule(file));
    if (typeof factory !== "function") {
      throw new Error(`Middleware '${name}' must export a function`);
    }

    app.middleware.register(name, () => {
      const result = (factory as MiddlewareFactory)(app);
      if (typeof result !== "function") {
        throw new Error(`Middleware '${name}' factory must return a function`);
      }
      return result as MiddlewareFn;
    });
  }

  app.middleware.setGlobal(global ?? []);

  if (app.http) {
    for (const name of global ?? []) {
      app.http.use(app.middleware.resolve(name));
    }
  }
}
