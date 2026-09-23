#!/usr/bin/env node
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createCommands } from "./commands.js";
import { matchCommand, type CliIo } from "./registry.js";

export async function runCli(argv: string[], io: Partial<CliIo> = {}): Promise<number> {
  const commands = createCommands(() => commands);
  const cwd = io.cwd ?? process.cwd();
  const stdout = io.stdout ?? process.stdout;
  const full: CliIo = {
    cwd,
    stdout,
    argv,
    spawn:
      io.spawn ??
      ((bin, args) => {
        const child = spawn(bin, args, { stdio: "inherit", shell: process.platform === "win32", cwd });
        child.on("exit", (code) => process.exit(code ?? 0));
      }),
  };

  const [commandName, ...args] = argv;
  const command = matchCommand(commands, commandName) ?? matchCommand(commands, "list");
  try {
    await command!.run(args, full);
    return 0;
  } catch (error) {
    stdout.write(`${error instanceof Error ? error.message : error}\n`);
    return 1;
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  runCli(process.argv.slice(2)).then((code) => {
    if (code !== 0) process.exit(code);
  });
}
