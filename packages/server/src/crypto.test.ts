import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, maskSecret, getEncryptionKey } from "./crypto.js";

describe("Crypto Module (AES-256-GCM)", () => {
  it("encrypts and decrypts secret roundtrip successfully", () => {
    const secret = "prsk_live_1234567890abcdef";
    const encrypted = encryptSecret(secret);

    expect(encrypted).toBeInstanceOf(Buffer);
    expect(encrypted.toString("utf8").startsWith("v1:")).toBe(true);

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(secret);
  });

  it("handles string and buffer inputs uniformly for decryption", () => {
    const secret = "my_super_secret_token";
    const encryptedBuf = encryptSecret(secret);
    const encryptedStr = encryptedBuf.toString("utf8");

    expect(decryptSecret(encryptedBuf)).toBe(secret);
    expect(decryptSecret(encryptedStr)).toBe(secret);
  });

  it("falls back gracefully for legacy unencrypted plaintext secrets", () => {
    const legacyPlaintext = "wasender_pat_legacy_plain_123";
    const decrypted = decryptSecret(legacyPlaintext);
    expect(decrypted).toBe(legacyPlaintext);

    const decryptedBuf = decryptSecret(Buffer.from(legacyPlaintext, "utf8"));
    expect(decryptedBuf).toBe(legacyPlaintext);
  });

  it("handles null, undefined, or empty values safely", () => {
    expect(decryptSecret(null)).toBe("");
    expect(decryptSecret(undefined)).toBe("");
    expect(decryptSecret("")).toBe("");
    expect(encryptSecret("").length).toBe(0);
  });

  it("masks secrets correctly for display", () => {
    expect(maskSecret("prsk_live_1234567890abcdef")).toBe("prsk_••••cdef");
    expect(maskSecret("whsec_9876543210fedcba")).toBe("whsec_••••dcba");
    expect(maskSecret("short")).toBe("••••");
    expect(maskSecret(null)).toBe("");
  });

  it("supports custom master key overrides", () => {
    const customKey = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    const secret = "custom_key_test_secret";
    const encrypted = encryptSecret(secret, customKey);
    const decrypted = decryptSecret(encrypted, customKey);

    expect(decrypted).toBe(secret);
  });
});
