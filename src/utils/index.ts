import { randomBytes, createHash, timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";

export function id(bytes = 12): string {
  return randomBytes(bytes).toString("hex");
}

export function hash(value: string, algorithm = "sha256"): string {
  return createHash(algorithm).update(value).digest("hex");
}

export function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return nodeTimingSafeEqual(left, right);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function timeout<T>(promise: Promise<T>, ms: number, message = "Timed out"): Promise<T> {
  let timer: NodeJS.Timeout;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: { times?: number; delayMs?: number } = {}
): Promise<T> {
  const times = options.times ?? 3;
  const delayMs = options.delayMs ?? 50;
  let last: unknown;
  for (let attempt = 1; attempt <= times; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (attempt < times) await sleep(delayMs * attempt);
    }
  }
  throw last;
}

export function pick<T extends object, K extends keyof T>(object: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) result[key] = object[key];
  return result;
}

export function omit<T extends object, K extends keyof T>(object: T, keys: K[]): Omit<T, K> {
  const skip = new Set<keyof T>(keys);
  const result = {} as Omit<T, K>;
  for (const [key, value] of Object.entries(object) as Array<[keyof T, T[keyof T]]>) {
    if (!skip.has(key)) (result as Record<string | number | symbol, unknown>)[key as string] = value;
  }
  return result;
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "***";
  return `${name[0] ?? "*"}***@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length < 4 ? "***" : `***${digits.slice(-4)}`;
}

export function paginate<T>(
  items: T[],
  page = 1,
  pageSize = 20
): { items: T[]; total: number; page: number; pageSize: number } {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(100, Math.max(1, pageSize));
  const start = (safePage - 1) * safeSize;
  return {
    items: items.slice(start, start + safeSize),
    total: items.length,
    page: safePage,
    pageSize: safeSize,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function compact<T extends Record<string, unknown>>(object: T): Partial<T> {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value != null)) as Partial<T>;
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function groupBy<T, K extends string | number>(
  items: T[],
  key: (item: T) => K
): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const group = key(item);
      acc[group] = acc[group] ?? [];
      acc[group].push(item);
      return acc;
    },
    {} as Record<K, T[]>
  );
}

export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function toInt(value: unknown, fallback = 0): number {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function now(): Date {
  return new Date();
}

export function iso(date: Date = new Date()): string {
  return date.toISOString();
}

export function parseJson<T = unknown>(value: string, fallback?: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    if (fallback !== undefined) return fallback;
    throw new Error("Invalid JSON");
  }
}

export function chunk<T>(items: T[], size: number): T[][] {
  const safe = Math.max(1, size);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += safe) {
    out.push(items.slice(i, i + safe));
  }
  return out;
}
