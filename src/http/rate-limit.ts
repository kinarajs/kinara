import type { RequestHandler } from "express";
import { RateLimitError } from "../errors.js";

export interface RateLimitStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void>;
}

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  key?: (req: { ip?: string; headers: Record<string, unknown> }) => string;
  enabled?: boolean;
}

interface Counter {
  count: number;
  resetAt: number;
}

export function createRateLimiter(
  options: RateLimitOptions = {},
  store?: RateLimitStore
): RequestHandler {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 60;
  const memory = new Map<string, Counter>();

  return async (req, _res, next) => {
    if (options.enabled === false) {
      next();
      return;
    }

    const key = (options.key ?? ((r) => r.ip || "anonymous"))(req);
    const now = Date.now();

    try {
      if (store) {
        const cached = await store.get<Counter>(`rl:${key}`);
        const current = cached && cached.resetAt > now ? cached : { count: 0, resetAt: now + windowMs };
        current.count += 1;
        await store.set(`rl:${key}`, current, Math.max(1, current.resetAt - now));
        if (current.count > max) {
          next(new RateLimitError(current.resetAt - now));
          return;
        }
      } else {
        const current = memory.get(key);
        if (!current || current.resetAt <= now) {
          memory.set(key, { count: 1, resetAt: now + windowMs });
        } else {
          current.count += 1;
          if (current.count > max) {
            next(new RateLimitError(current.resetAt - now));
            return;
          }
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
