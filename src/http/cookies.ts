import type { RequestHandler } from "express";

/** Parses the `Cookie` header onto `req.cookies`. Unsigned cookies only. */
export function cookies(): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.cookie;
    const jar: Record<string, string> = {};
    if (typeof header === "string" && header.length > 0) {
      for (const part of header.split(";")) {
        const eq = part.indexOf("=");
        if (eq <= 0) continue;
        const key = decodeURIComponent(part.slice(0, eq).trim());
        const value = decodeURIComponent(part.slice(eq + 1).trim());
        if (key) jar[key] = value;
      }
    }
    req.cookies = jar;
    next();
  };
}
