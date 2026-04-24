import {
  hasActiveAccess,
  hasPaidAccess,
  hasSubscriptionExpired
} from "../lib/access-service.js";
import { sendError } from "../utils/http.js";

function rejectWithRedirect(res, error, redirectTo) {
  return sendError(res, 403, error, { redirectTo });
}

export function requireDemoAccess(req, res, next) {
  if (!hasPaidAccess(req.user)) {
    return next();
  }

  if (hasActiveAccess(req.user)) {
    return rejectWithRedirect(res, "Access already active", "/dashboard");
  }

  if (hasSubscriptionExpired(req.user)) {
    return rejectWithRedirect(res, "Subscription expired", "/pricing");
  }

  return rejectWithRedirect(res, "Access unavailable", "/pricing");
}

export function requireDashboardAccess(req, res, next) {
  if (!hasPaidAccess(req.user)) {
    return rejectWithRedirect(res, "Access inactive", "/demo");
  }

  if (hasSubscriptionExpired(req.user)) {
    return rejectWithRedirect(res, "Subscription expired", "/pricing");
  }

  if (!hasActiveAccess(req.user)) {
    return rejectWithRedirect(res, "Access inactive", "/pricing");
  }

  return next();
}
