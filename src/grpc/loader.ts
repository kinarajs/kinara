import path from "node:path";
import type { Kinara } from "../app.js";
import { exportValue, firstExisting, importModule, listDirectories } from "../discovery/scan.js";
import type { RpcService } from "./define.js";
import { KinaraGrpcServer } from "./server.js";

export async function loadRpc(app: Kinara, modulesDir: string): Promise<KinaraGrpcServer | undefined> {
  const modules = await listDirectories(app.root, modulesDir);
  const services: RpcService[] = [];

  for (const moduleName of modules) {
    const moduleRoot = path.join(app.root, modulesDir, moduleName);
    const file = await firstExisting(moduleRoot, ["rpc.ts", "rpc.js", "rpc.mjs", "grpc.ts", "grpc.js"]);
    if (!file) continue;
    const exported = exportValue(await importModule(file));
    if (exported && typeof exported === "object" && "service" in (exported as RpcService)) {
      services.push(exported as RpcService);
    }
  }

  if (services.length === 0) return undefined;

  const server = new KinaraGrpcServer(app);
  for (const service of services) {
    await server.add(service);
  }
  return server;
}
