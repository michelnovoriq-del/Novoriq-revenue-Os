import crypto from "crypto";

export function createUserId() {
  return crypto.randomUUID();
}

export function createSessionId() {
  return crypto.randomUUID();
}
