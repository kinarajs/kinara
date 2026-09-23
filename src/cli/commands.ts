import { readdir } from "node:fs/promises";
import path from "node:path";
import { generateKey } from "../crypto/fields.js";
import type { CliCommand, CliIo } from "./registry.js";
import { renderList } from "./registry.js";
import {
  hookStub,
  middlewareStub,
  modelStub,
  moduleRoutes,
  newServiceFiles,
  providerStub,
  rpcStub,
  seederStub,
  writeStub,
} from "./stubs.js";

export function createCommands(all: () => CliCommand[]): CliCommand[] {
  const commands: CliCommand[] = [
    {
      name: "list",
      aliases: ["help", "--help", "-h"],
      description: "List available commands",
      run(_args, io) {
        io.stdout.write(renderList(all()));
      },
    },
    {
      name: "new",
      aliases: ["create"],
      description: "Create a new Kinara service",
      async run(args, io) {
        const name = args[0] || "kinara-service";
        const root = path.resolve(io.cwd, name);
        for (const [file, contents] of Object.entries(newServiceFiles(name))) {
          await writeStub(root, file, contents);
        }
        io.stdout.write(`Created ${name}. Next:\n  cd ${name}\n  npm install\n  kinara serve\n`);
      },
    },
    {
      name: "serve",
      aliases: ["dev"],
      description: "Start the development server (tsx watch)",
      run(_args, io) {
        if (!io.spawn) throw new Error("spawn is not available");
        io.spawn("npx", ["tsx", "watch", "src/index.ts"]);
      },
    },
    {
      name: "start",
      description: "Start the production server (node dist)",
      run(_args, io) {
        if (!io.spawn) throw new Error("spawn is not available");
        io.spawn("node", ["dist/index.js"]);
      },
    },
    {
      name: "make:module",
      aliases: ["generate:module"],
      description: "Create a module with routes and hooks",
      async run(args, io) {
        const name = required(args[0], "usage: kinara make:module <name>");
        await writeStub(io.cwd, `src/modules/${name}/routes.ts`, moduleRoutes(name));
        await writeStub(io.cwd, `src/modules/${name}/hooks/.gitkeep`, "");
        io.stdout.write(`module ${name} created\n`);
      },
    },
    {
      name: "make:hook",
      aliases: ["generate:hook"],
      description: "Create a hook in a module",
      async run(args, io) {
        const [moduleName, id, eventName] = args;
        if (!moduleName || !id || !eventName) {
          throw new Error("usage: kinara make:hook <module> <id> <event>");
        }
        await writeStub(io.cwd, `src/modules/${moduleName}/hooks/${id}.ts`, hookStub(id, eventName));
        io.stdout.write(`hook ${id} created\n`);
      },
    },
    {
      name: "make:middleware",
      description: "Create a named middleware file",
      async run(args, io) {
        const name = required(args[0], "usage: kinara make:middleware <name>");
        await writeStub(io.cwd, `src/middleware/${name}.ts`, middlewareStub(name));
        io.stdout.write(`middleware ${name} created\n`);
      },
    },
    {
      name: "make:provider",
      description: "Create a module provider",
      async run(args, io) {
        const moduleName = required(args[0], "usage: kinara make:provider <module> <name>");
        const name = required(args[1], "usage: kinara make:provider <module> <name>");
        await writeStub(io.cwd, `src/modules/${moduleName}/providers/${name}.ts`, providerStub(name));
        io.stdout.write(`provider ${name} created\n`);
      },
    },
    {
      name: "make:model",
      description: "Create an ORM model",
      async run(args, io) {
        const name = required(args[0], "usage: kinara make:model <name>");
        await writeStub(io.cwd, `src/models/${name}.ts`, modelStub(name));
        io.stdout.write(`model ${name} created\n`);
      },
    },
    {
      name: "make:rpc",
      description: "Create a gRPC service for a module",
      async run(args, io) {
        const moduleName = required(args[0], "usage: kinara make:rpc <module> <service>");
        const service = required(args[1], "usage: kinara make:rpc <module> <service>");
        await writeStub(io.cwd, `src/modules/${moduleName}/rpc.ts`, rpcStub(moduleName, service));
        io.stdout.write(`rpc ${service} created\n`);
      },
    },
    {
      name: "make:seeder",
      description: "Create a seeder",
      async run(args, io) {
        const name = required(args[0], "usage: kinara make:seeder <name>");
        await writeStub(io.cwd, `src/database/seeders/${name}.ts`, seederStub(name));
        io.stdout.write(`seeder ${name} created\n`);
      },
    },
    {
      name: "key:generate",
      description: "Generate KINARA_KEY for field encryption",
      run(_args, io) {
        io.stdout.write(`KINARA_KEY=${generateKey()}\n`);
      },
    },
    {
      name: "route:list",
      description: "List module route files",
      async run(_args, io) {
        const modulesDir = path.join(io.cwd, "src/modules");
        let modules: string[] = [];
        try {
          modules = await readdir(modulesDir);
        } catch {
          io.stdout.write("No modules found.\n");
          return;
        }
        for (const name of modules.sort()) {
          io.stdout.write(`${name}  src/modules/${name}/routes.ts\n`);
        }
      },
    },
    {
      name: "cache:clear",
      description: "Remind that in-memory cache clears on restart",
      run(_args, io) {
        io.stdout.write("In-memory cache clears on process restart. Flush Redis separately if used.\n");
      },
    },
  ];

  commands.push({
    name: "generate",
    description: "Alias for make:* (generate module|hook)",
    async run(args, io) {
      if (args[0] === "module") return commands.find((c) => c.name === "make:module")!.run(args.slice(1), io);
      if (args[0] === "hook") return commands.find((c) => c.name === "make:hook")!.run(args.slice(1), io);
      throw new Error("usage: kinara generate module|hook ...");
    },
  });

  return commands;
}

function required(value: string | undefined, message: string): string {
  if (!value) throw new Error(message);
  return value;
}
