import { hasActiveAccess, hasSubscriptionExpired } from "./access-service.js";

export function resolvePostLoginRoute(user) {
  if (user.role === "admin") {
    return "/admin";
  }

  if (user.hasAccess === false) {
    return "/demo";
  }

  if (hasActiveAccess(user)) {
    return "/dashboard";
  }

  return "/pricing";
}
