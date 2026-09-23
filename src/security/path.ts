import path from "node:path";
import { PathEscapeError } from "../errors.js";

export function resolveSafePath(root: string, filePath: string): string {
  if (typeof filePath !== "string" || filePath.length === 0) {
    throw new PathEscapeError(String(filePath));
  }

  const normalizedRoot = path.resolve(root);
  const resolved = path.resolve(normalizedRoot, filePath);
  const relative = path.relative(normalizedRoot, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new PathEscapeError(filePath);
  }

  return resolved;
}
