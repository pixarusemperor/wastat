import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;
const DEV_DEFAULT_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 32-byte hex for dev/test

/**
 * Resolves the 32-byte encryption key from environment or default for dev/test.
 */
export function getEncryptionKey(overrideKey?: string): Buffer {
  const rawKey =
    overrideKey ||
    process.env.ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.WASENDER_PAT ||
    DEV_DEFAULT_KEY;

  // If 64-character hex string, parse as hex
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }

  const buf = Buffer.from(rawKey, "utf8");
  if (buf.length === 32) {
    return buf;
  }

  // Hash key to 32 bytes if provided key is not exactly 32 bytes
  return crypto.createHash("sha256").update(buf).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output envelope format: v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encryptSecret(plaintext: string, masterKey?: string): Buffer {
  if (!plaintext) {
    return Buffer.from("");
  }

  const key = getEncryptionKey(masterKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  const envelope = `v1:${iv.toString("hex")}:${authTag}:${ciphertext}`;
  return Buffer.from(envelope, "utf8");
}

/**
 * Decrypts a ciphertext envelope string/Buffer using AES-256-GCM.
 * If the input does not have the 'v1:' prefix, it is treated as a legacy plaintext string for backward compatibility.
 */
export function decryptSecret(cipherInput: Buffer | string | null | undefined, masterKey?: string): string {
  if (!cipherInput) {
    return "";
  }

  const raw = Buffer.isBuffer(cipherInput) ? cipherInput.toString("utf8") : String(cipherInput);
  if (!raw) {
    return "";
  }

  // Legacy backward compatibility: unencrypted plaintext values stored prior to v2
  if (!raw.startsWith("v1:")) {
    return raw;
  }

  const parts = raw.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted secret envelope format");
  }

  const [, ivHex, tagHex, cipherHex] = parts;
  const key = getEncryptionKey(masterKey);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Masks a secret string for UI presentation or logging (e.g. prsk_••••3a1f).
 */
export function maskSecret(secret: string | null | undefined): string {
  if (!secret) return "";
  if (secret.length <= 8) return "••••";

  // If secret has a prefix like prsk_ or whsec_
  const prefixMatch = secret.match(/^([a-z0-9]+_)/i);
  const prefix = prefixMatch ? prefixMatch[1] : secret.slice(0, 4);
  const suffix = secret.slice(-4);
  return `${prefix}••••${suffix}`;
}
