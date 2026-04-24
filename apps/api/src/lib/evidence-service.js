import { createSessionId } from "./id.js";
import { env } from "../config/env.js";
import {
  createActivityLog,
  createEvidenceSession,
  findEvidenceSessionById
} from "./evidence-store.js";

const MAX_METADATA_JSON_LENGTH = 4000;
const MAX_METADATA_DEPTH = 4;
const MAX_METADATA_KEYS = 25;
const MAX_METADATA_ARRAY_ITEMS = 25;
const MAX_STRING_LENGTH = 500;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeIpAddress(ipAddress) {
  if (typeof ipAddress !== "string") {
    return "";
  }

  const trimmedIp = ipAddress.trim();
  if (trimmedIp.startsWith("::ffff:")) {
    return trimmedIp.slice("::ffff:".length);
  }

  return trimmedIp;
}

export function extractClientIp(req) {
  const forwardedFor = req.get("x-forwarded-for");
  const forwardedIp = typeof forwardedFor === "string" ? forwardedFor.split(",")[0]?.trim() : "";
  const resolvedIp = forwardedIp || req.ip || req.socket?.remoteAddress || "";
  return normalizeIpAddress(resolvedIp);
}

function sanitizeString(value) {
  return value.slice(0, MAX_STRING_LENGTH);
}

function sanitizeMetadataValue(value, depth = 0) {
  if (value === null) {
    return null;
  }

  if (depth > MAX_METADATA_DEPTH) {
    return "[truncated]";
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_METADATA_ARRAY_ITEMS).map((item) => sanitizeMetadataValue(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, MAX_METADATA_KEYS)
        .filter(([key]) => typeof key === "string" && key.length > 0)
        .map(([key, nestedValue]) => [sanitizeString(key), sanitizeMetadataValue(nestedValue, depth + 1)])
    );
  }

  return String(value);
}

export function sanitizeActivityMetadata(metadata) {
  const sanitizedMetadata = sanitizeMetadataValue(metadata ?? {});
  const serialized = JSON.stringify(sanitizedMetadata);

  if (!serialized) {
    return {};
  }

  if (serialized.length > MAX_METADATA_JSON_LENGTH) {
    throw createHttpError(400, "Activity metadata is too large");
  }

  return sanitizedMetadata;
}

async function lookupGeo(ipAddress) {
  if (!ipAddress || !env.IPAPI_KEY) {
    return {
      country: null,
      city: null
    };
  }

  try {
    const response = await fetch(
      `https://api.ipapi.com/${encodeURIComponent(ipAddress)}?access_key=${encodeURIComponent(env.IPAPI_KEY)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      return {
        country: null,
        city: null
      };
    }

    const data = await response.json();
    return {
      country: typeof data?.country_name === "string" ? data.country_name : null,
      city: typeof data?.city === "string" ? data.city : null
    };
  } catch {
    return {
      country: null,
      city: null
    };
  }
}

export async function captureEvidenceSession({ userId, fingerprintId, userAgent, ipAddress }) {
  const normalizedFingerprintId =
    typeof fingerprintId === "string" ? fingerprintId.trim() : "";
  const normalizedUserAgent = typeof userAgent === "string" ? userAgent.trim().slice(0, 1000) : "";
  const normalizedIpAddress = normalizeIpAddress(ipAddress);

  if (!normalizedFingerprintId) {
    throw createHttpError(400, "fingerprintId is required");
  }

  const geo = await lookupGeo(normalizedIpAddress);
  const session = await createEvidenceSession({
    id: createSessionId(),
    userId,
    fingerprintId: normalizedFingerprintId,
    ipAddress: normalizedIpAddress || null,
    country: geo.country,
    city: geo.city,
    userAgent: normalizedUserAgent || null
  });

  return session;
}

export async function logEvidenceActivity({ userId, sessionId, action, metadata }) {
  const normalizedSessionId = typeof sessionId === "string" ? sessionId.trim() : "";
  const normalizedAction = typeof action === "string" ? action.trim() : "";

  if (!normalizedSessionId) {
    throw createHttpError(400, "sessionId is required");
  }

  if (!normalizedAction) {
    throw createHttpError(400, "action is required");
  }

  const session = await findEvidenceSessionById(normalizedSessionId);

  if (!session || session.userId !== userId) {
    throw createHttpError(404, "Session not found");
  }

  const sanitizedMetadata = sanitizeActivityMetadata(metadata);

  return createActivityLog({
    userId,
    sessionId: session.id,
    action: normalizedAction.slice(0, 120),
    metadata: sanitizedMetadata
  });
}
