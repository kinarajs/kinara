import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { slug } from "../utils/index.js";

export async function writeStub(root: string, relative: string, contents: string): Promise<string> {
  const full = path.join(root, relative);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, contents);
  return full;
}

export function newServiceFiles(name: string): Record<string, string> {
  return {
    "package.json": JSON.stringify(
      {
        name,
        private: true,
        type: "module",
        scripts: { dev: "kinara serve", build: "tsc", start: "kinara start" },
        dependencies: { "@kinarajs/kinara": "latest" },
        devDependencies: { tsx: "^4.19.2", typescript: "^5.7.2" },
      },
      null,
      2
    ),
    "src/index.ts": `import { createApp } from "@kinarajs/kinara";\n\nconst app = await createApp({ root: import.meta.dirname });\nawait app.listen();\n`,
    "src/config/app.ts": `export default { modulesDir: "modules", http: true, grpc: true, websocket: true };\n`,
    "src/modules/demo/routes.ts": `import { event, handle, ok } from "@kinarajs/kinara";\nimport type { RouteRegistrar } from "@kinarajs/kinara";\n\nconst routes: RouteRegistrar = (_http, router) => {\n  router.get("/health", (_req, res) => res.json(ok({ status: "ok" })));\n  router.post("/signup", handle(async (_req, res) => {\n    const user = { id: Date.now(), email: "ada@example.com" };\n    await event().emit("user.created", user);\n    res.status(201).json(ok(user));\n  }));\n};\n\nexport default routes;\n`,
    "src/modules/demo/hooks/log-user-signup.ts": `import { defineHook } from "@kinarajs/kinara";\n\nexport default defineHook({\n  id: "log-user-signup",\n  on: "user.created",\n  async handle(payload) {\n    console.log("user.created", payload);\n  },\n});\n`,
  };
}

export function moduleRoutes(name: string): string {
  return `import { ok } from "@kinarajs/kinara";\nimport type { RouteRegistrar } from "@kinarajs/kinara";\n\nconst routes: RouteRegistrar = (_http, router) => {\n  router.get("/${name}/health", (_req, res) => res.json(ok({ module: "${name}" })));\n};\n\nexport default routes;\n`;
}

export function hookStub(id: string, eventName: string): string {
  return `import { defineHook } from "@kinarajs/kinara";\n\nexport default defineHook({\n  id: "${id}",\n  on: "${eventName}",\n  async handle(payload) {\n    console.log("${eventName}", payload);\n  },\n});\n`;
}

export function middlewareStub(name: string): string {
  return `import type { MiddlewareFactory } from "@kinarajs/kinara";\n\nconst ${slug(name).replace(/-/g, "_")}: MiddlewareFactory = () => (req, _res, next) => {\n  next();\n};\n\nexport default ${slug(name).replace(/-/g, "_")};\n`;
}

export function providerStub(name: string): string {
  const klass = toPascal(name) + "Provider";
  return `import type { Kinara, ServiceProvider } from "@kinarajs/kinara";\n\nexport default class ${klass} implements ServiceProvider {\n  register(app: Kinara) {\n    app.container.instance("${slug(name)}", true);\n  }\n}\n`;
}

export function modelStub(name: string): string {
  const klass = toPascal(name);
  return `import { defineModel } from "@kinarajs/kinara";\n\nexport interface ${klass} {\n  _id: string;\n  createdAt: string;\n}\n\nexport const ${klass}Model = defineModel<${klass}>({\n  collection: "${slug(name)}s",\n  encrypt: [],\n});\n`;
}

export function rpcStub(moduleName: string, service: string): string {
  return `import { defineRpc } from "@kinarajs/kinara";\n\nexport default defineRpc({\n  package: "${moduleName}.v1",\n  service: "${toPascal(service)}",\n  proto: \`\n    syntax = "proto3";\n    package ${moduleName}.v1;\n    service ${toPascal(service)} { rpc Ping (PingRequest) returns (PingReply); }\n    message PingRequest {}\n    message PingReply { string status = 1; }\n  \`,\n  methods: {\n    Ping: async () => ({ status: "ok" }),\n  },\n});\n`;
}

export function seederStub(name: string): string {
  const fn = `seed${toPascal(name)}`;
  return `export async function ${fn}() {\n  // insert starter rows here\n}\n`;
}

function toPascal(value: string): string {
  return slug(value)
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join("");
}
