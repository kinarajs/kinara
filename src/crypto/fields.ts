import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { KinaraError } from "../errors.js";

const PREFIX = "k1.";
const ALGO = "aes-256-gcm";

let activeKey: Buffer | undefined;

export function setEncryptionKey(secret?: string): void {
  activeKey = secret ? deriveKey(secret) : undefined;
}

export function getEncryptionKey(): Buffer {
  if (activeKey) return activeKey;
  const fromEnv = process.env.KINARA_KEY;
  if (!fromEnv) {
    throw new KinaraError("Database encryption needs KINARA_KEY or crypto.key.", {
      code: "ENCRYPTION_KEY_MISSING",
      expose: false,
    });
  }
  activeKey = deriveKey(fromEnv);
  return activeKey;
}

export function generateKey(): string {
  return randomBytes(32).toString("base64url");
}

function deriveKey(secret: string): Buffer {
  if (/^[A-Za-z0-9_-]{43}$/.test(secret) || /^[A-Za-z0-9+/]+=*$/.test(secret)) {
    try {
      const raw = Buffer.from(secret, secret.includes("+") || secret.includes("/") ? "base64" : "base64url");
      if (raw.length === 32) return raw;
    } catch {
      // fall through to hash
    }
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptValue(value: unknown, key = getEncryptionKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const payload = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptValue<T = unknown>(value: unknown, key = getEncryptionKey()): T {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return value as T;
  const raw = Buffer.from(value.slice(PREFIX.length), "base64url");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decoded = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  return JSON.parse(decoded) as T;
}

export function isEncrypted(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptDocument<T extends Record<string, unknown>>(
  document: T,
  fields: string[],
  key?: Buffer
): T {
  if (fields.length === 0) return document;
  const next = { ...document };
  let resolved = key;
  for (const field of fields) {
    if (next[field] !== undefined && !isEncrypted(next[field])) {
      resolved ??= getEncryptionKey();
      (next as Record<string, unknown>)[field] = encryptValue(next[field], resolved);
    }
  }
  return next;
}

export function decryptDocument<T extends Record<string, unknown>>(
  document: T,
  fields: string[],
  key?: Buffer
): T {
  if (fields.length === 0) return document;
  const next = { ...document };
  let resolved = key;
  for (const field of fields) {
    if (isEncrypted(next[field])) {
      resolved ??= getEncryptionKey();
      (next as Record<string, unknown>)[field] = decryptValue(next[field], resolved);
    }
  }
  return next;
}
