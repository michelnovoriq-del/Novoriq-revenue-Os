import { hasActiveAccess, hasPaidAccess, hasSubscriptionExpired } from "./access-service.js";

export function resolvePostLoginRoute(user) {
  if (user.role === "admin") {
    return "/admin";
  }

  if (!hasPaidAccess(user)) {
    return "/demo";
  }

  if (hasActiveAccess(user)) {
    return "/dashboard";
  }

  return "/pricing";
}
