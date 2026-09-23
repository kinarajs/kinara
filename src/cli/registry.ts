export interface CliIo {
  cwd: string;
  stdout: { write(chunk: string): void };
  argv: string[];
  spawn?: (bin: string, args: string[]) => void;
}

export interface CliCommand {
  name: string;
  description: string;
  aliases?: string[];
  run(args: string[], io: CliIo): Promise<void> | void;
}

export function matchCommand(commands: CliCommand[], input?: string): CliCommand | undefined {
  if (!input) return undefined;
  return commands.find((command) => command.name === input || command.aliases?.includes(input));
}

export function renderList(commands: CliCommand[]): string {
  const width = Math.max(...commands.map((command) => command.name.length));
  const lines = [
    "Kinara 0.0.1 (unstable)",
    "",
    "Usage:",
    "  kinara <command> [options]",
    "",
    "Available commands:",
  ];
  for (const command of [...commands].sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(`  ${command.name.padEnd(width + 2)}${command.description}`);
  }
  return lines.join("\n") + "\n";
}
