import { describe, expect, it } from "vitest";
import {
  decryptDocument,
  decryptValue,
  encryptDocument,
  encryptValue,
  generateKey,
  isEncrypted,
  setEncryptionKey,
} from "../src/crypto/fields.js";
import { KinaraError } from "../src/errors.js";

describe("field encryption", () => {
  it("round-trips values with AES-GCM", () => {
    const key = generateKey();
    setEncryptionKey(key);
    const encrypted = encryptValue({ email: "a@b.c", n: 3 });
    expect(isEncrypted(encrypted)).toBe(true);
    expect(decryptValue(encrypted)).toEqual({ email: "a@b.c", n: 3 });
    const doc = encryptDocument({ name: "Ada", ssn: "123" }, ["ssn"]);
    expect(isEncrypted(doc.ssn)).toBe(true);
    expect(decryptDocument(doc, ["ssn"]).ssn).toBe("123");
    setEncryptionKey(undefined);
  });

  it("fails closed without a key", () => {
    setEncryptionKey(undefined);
    delete process.env.KINARA_KEY;
    expect(() => encryptValue("x")).toThrow(KinaraError);
  });
});
