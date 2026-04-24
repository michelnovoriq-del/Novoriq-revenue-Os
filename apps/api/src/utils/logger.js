const REDACTED_KEYS = [
  "authorization",
  "cookie",
  "password",
  "passwordhash",
  "password_hash",
  "token",
  "apikey",
  "api_key",
  "secret",
  "signature",
  "restrictedkey",
  "restricted_key",
  "webhooksecret",
  "webhook_secret"
];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function shouldRedact(key) {
  const normalizedKey = String(key).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return REDACTED_KEYS.some((redactedKey) => normalizedKey.includes(redactedKey));
}

function redact(value) {
  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        shouldRedact(key) ? "[REDACTED]" : redact(nestedValue)
      ])
    );
  }

  if (typeof value === "string" && value.length > 2000) {
    return `${value.slice(0, 2000)}...[truncated]`;
  }

  return value;
}

function writeLog(level, message, context = {}) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...redact(context)
  };

  const payload = JSON.stringify(entry);

  if (level === "error") {
    console.error(payload);
    return;
  }

  if (level === "warn") {
    console.warn(payload);
    return;
  }

  console.info(payload);
}

export const logger = {
  info(message, context) {
    writeLog("info", message, context);
  },
  warn(message, context) {
    writeLog("warn", message, context);
  },
  error(message, context) {
    writeLog("error", message, context);
  }
};
