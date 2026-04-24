import { ZodError } from "zod";
import { logger } from "../utils/logger.js";
import { sendError } from "../utils/http.js";

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  logger.error("Unhandled request error", {
    method: req.method,
    path: req.originalUrl,
    statusCode: err.statusCode || 500,
    message: err.message,
    details: err.details
  });

  if (err instanceof ZodError) {
    return sendError(res, 400, err.issues[0]?.message || "Invalid request payload");
  }

  if (err.type === "entity.parse.failed") {
    return sendError(res, 400, "Invalid JSON payload");
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode >= 500 ? "Internal server error" : err.message;

  return sendError(res, statusCode, message);
}
