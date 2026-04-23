import { ZodError } from "zod";

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: err.issues[0]?.message || "Invalid request payload"
    });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode >= 500 ? "Internal server error" : err.message;

  return res.status(statusCode).json({ error: message });
}
