import { sendError } from "../utils/http.js";

export function authorizeRole(...roles) {
  return function authorizeRoleMiddleware(req, res, next) {
    if (!req.user) {
      return sendError(res, 401, "Authentication required");
    }

    if (!roles.includes(req.user.role)) {
      return sendError(res, 403, "Insufficient permissions");
    }

    return next();
  };
}
