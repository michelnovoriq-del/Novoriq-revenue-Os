import crypto from "crypto";
import { env } from "../config/env.js";

const ENCRYPTION_ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

function getEncryptionKeyBuffer() {
  return Buffer.from(env.ENCRYPTION_KEY, "hex");
}

export function encrypt(text) {
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("A non-empty value is required for encryption");
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKeyBuffer(), iv);
  const encryptedBuffer = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);

  return `${iv.toString("hex")}:${encryptedBuffer.toString("hex")}`;
}

export function decryptToBuffer(hash) {
  if (typeof hash !== "string" || hash.length === 0) {
    throw new Error("A non-empty encrypted value is required");
  }

  const [ivHex, encryptedHex] = hash.split(":");

  if (!ivHex || !encryptedHex) {
    throw new Error("Invalid encrypted value format");
  }

  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getEncryptionKeyBuffer(),
    Buffer.from(ivHex, "hex")
  );

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]);
}

export function decrypt(hash) {
  const decryptedBuffer = decryptToBuffer(hash);
  const decryptedText = decryptedBuffer.toString("utf8");
  decryptedBuffer.fill(0);
  return decryptedText;
}

export function clearSensitiveBuffer(buffer) {
  if (Buffer.isBuffer(buffer)) {
    buffer.fill(0);
  }
}
