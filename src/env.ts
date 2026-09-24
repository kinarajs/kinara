import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** Load `.env` from `from` and cwd. Never overwrites keys already in `process.env`. */
export function loadEnv(from?: string): number {
  const dirs = [from, process.cwd()].filter((dir): dir is string => Boolean(dir));
  const seen = new Set<string>();
  let applied = 0;

  for (const dir of dirs) {
    const file = path.resolve(dir, ".env");
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const parsed = parseEnv(readFileSync(file, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
        applied += 1;
      }
    }
  }

  return applied;
}
