import { KinaraError } from "../errors.js";

export interface CacheDriver {
  readonly name: string;
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void>;
  del(key: string): Promise<void>;
  close?(): Promise<void>;
}

export class MemoryCache implements CacheDriver {
  readonly name = "memory";
  private readonly store = new Map<string, { value: unknown; expiresAt?: number }>();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async close(): Promise<void> {
    this.store.clear();
  }
}

export class RedisCache implements CacheDriver {
  readonly name = "redis";

  constructor(private readonly client: { get(key: string): Promise<string | null>; set(key: string, value: string, mode?: string, ttl?: number): Promise<unknown>; del(key: string): Promise<unknown>; quit?: () => Promise<unknown> }) {}

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const payload = JSON.stringify(value);
    if (ttlMs) {
      await this.client.set(key, payload, "PX", ttlMs);
    } else {
      await this.client.set(key, payload);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async close(): Promise<void> {
    await this.client.quit?.();
  }
}

export class CacheManager {
  constructor(private driver: CacheDriver) {}

  use(driver: CacheDriver): this {
    this.driver = driver;
    return this;
  }

  driverName(): string {
    return this.driver.name;
  }

  get<T>(key: string): Promise<T | undefined> {
    return this.driver.get<T>(key);
  }

  set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    return this.driver.set(key, value, ttlMs);
  }

  del(key: string): Promise<void> {
    return this.driver.del(key);
  }

  async wrap<T>(key: string, ttlMs: number, loader: () => Promise<T> | T): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await loader();
    await this.set(key, value, ttlMs);
    return value;
  }

  async close(): Promise<void> {
    await this.driver.close?.();
  }
}

export interface MemcachedLike {
  get(key: string, cb: (err: Error | null, data: unknown) => void): void;
  set(key: string, value: unknown, lifetime: number, cb: (err: Error | null) => void): void;
  del(key: string, cb: (err: Error | null) => void): void;
  end?(): void;
}

function memcachedCallback<T>(run: (cb: (err: Error | null, data?: unknown) => void) => void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    run((err, data) => (err ? reject(err) : resolve(data as T | undefined)));
  });
}

/** Memcached driver. TTL is milliseconds, converted to whole seconds (minimum 1). */
export class MemcachedCache implements CacheDriver {
  readonly name = "memcached";

  constructor(private readonly client: MemcachedLike) {}

  async get<T>(key: string): Promise<T | undefined> {
    const data = await memcachedCallback<T>((cb) => this.client.get(key, cb));
    return data === undefined || data === null ? undefined : data;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const seconds = ttlMs ? Math.max(1, Math.ceil(ttlMs / 1000)) : 0;
    await memcachedCallback((cb) => this.client.set(key, value, seconds, cb));
  }

  async del(key: string): Promise<void> {
    await memcachedCallback((cb) => this.client.del(key, cb));
  }

  async close(): Promise<void> {
    this.client.end?.();
  }
}

export async function createMemcachedCache(servers: string | string[]): Promise<MemcachedCache> {
  try {
    const imported = (await import("memcached")) as { default?: new (servers: string | string[]) => MemcachedLike };
    const Memcached = imported.default ?? (imported as unknown as new (servers: string | string[]) => MemcachedLike);
    return new MemcachedCache(new Memcached(servers));
  } catch {
    throw new KinaraError("Memcached cache requires the optional peer `memcached`.", {
      code: "MISSING_PEER",
    });
  }
}

export async function createRedisCache(url: string): Promise<RedisCache> {
  try {
    const Redis = (await import("ioredis")).default;
    return new RedisCache(new Redis(url));
  } catch {
    throw new KinaraError("Redis cache requires the optional peer `ioredis`.", {
      code: "MISSING_PEER",
    });
  }
}
