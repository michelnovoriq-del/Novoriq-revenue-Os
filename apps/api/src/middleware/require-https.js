import { env } from "../config/env.js";
import { sendError } from "../utils/http.js";

const ALLOWED_INSECURE_PREFIXES = ["/api/health"];

export function requireHttps(req, res, next) {
  if (!env.isProduction) {
    return next();
  }

  const isHttps = req.secure || req.get("x-forwarded-proto") === "https";

  if (isHttps || ALLOWED_INSECURE_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    return next();
  }

  return sendError(res, 400, "HTTPS is required");
}
