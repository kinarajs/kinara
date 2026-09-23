/**
 * Strip prototype pollution and non-JSON values before events cross a bus.
 * Structured-clone first; fall back to JSON round-trip.
 */
export function sanitizePayload<T>(payload: T): T {
  if (payload === undefined) return payload;

  try {
    return structuredClone(payload);
  } catch {
    try {
      return JSON.parse(JSON.stringify(payload), (_key, value) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          const clean: Record<string, unknown> = Object.create(null);
          for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
            if (key === "__proto__" || key === "prototype" || key === "constructor") {
              continue;
            }
            clean[key] = entry;
          }
          return clean;
        }
        return value;
      }) as T;
    } catch {
      return payload;
    }
  }
}

export function decodeEventBody(raw: string | Buffer): unknown {
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : raw;
  const parsed = JSON.parse(text) as unknown;
  return sanitizePayload(parsed);
}
