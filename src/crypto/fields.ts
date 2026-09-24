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

export interface VersionedKeyring {
  /** Key id written into new ciphertext, for example `"1"`. */
  active: string;
  keys: Record<string, string>;
}

const VERSIONED = /^v([^:]+):([0-9a-f]+):([0-9a-f]+):([0-9a-f]+)$/i;

/**
 * Matches the auth-service ciphertext `v{version}:{iv}:{tag}:{hex}`.
 * The key is the first 32 characters of the base64 SHA-256 digest, used as UTF-8 bytes.
 */
export function deriveVersionedKey(secret: string): Buffer {
  return Buffer.from(createHash("sha256").update(String(secret)).digest("base64").substring(0, 32));
}

export function isVersionedCipher(value: unknown): boolean {
  return typeof value === "string" && VERSIONED.test(value);
}

export function encryptVersioned(text: string, ring: VersionedKeyring): string {
  const secret = ring.keys[ring.active];
  if (!secret) {
    throw new KinaraError(`Encryption key for version ${ring.active} not found.`, {
      code: "ENCRYPTION_KEY_MISSING",
      expose: false,
    });
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, deriveVersionedKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v${ring.active}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptVersioned(value: string, ring: VersionedKeyring): string {
  const match = VERSIONED.exec(value);
  if (!match) return value;
  const [, version, ivHex, tagHex, encryptedHex] = match;
  const secret = ring.keys[version];
  if (!secret) {
    throw new KinaraError(`Encryption key for version ${version} not found.`, {
      code: "ENCRYPTION_KEY_MISSING",
      expose: false,
    });
  }
  const decipher = createDecipheriv(ALGO, deriveVersionedKey(secret), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
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
