function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const DISALLOWED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function sanitizeInput(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeInput);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const sanitized = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (DISALLOWED_KEYS.has(key)) {
      continue;
    }

    sanitized[key] = sanitizeInput(nestedValue);
  }

  return sanitized;
}
