import { sanitizeInput } from "../utils/sanitize-input.js";

export function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeInput(req.body);
  }

  next();
}
