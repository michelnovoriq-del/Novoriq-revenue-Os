import { updateUser } from "./user-store.js";

export const ACCESS_UNLOCK_WINDOW_MS = 48 * 60 * 60 * 1000;

export function hasSubscriptionExpired(user) {
  if (!user.subscription_expires_at) {
    return false;
  }

  return Date.now() >= user.subscription_expires_at;
}

export function hasActiveAccess(user) {
  return user.hasAccess === true && !hasSubscriptionExpired(user);
}

export async function grantTimedAccess(userId, durationMs = ACCESS_UNLOCK_WINDOW_MS) {
  const expiresAt = Date.now() + durationMs;

  return updateUser(userId, (currentUser) => ({
    ...currentUser,
    hasAccess: true,
    subscription_expires_at: expiresAt
  }));
}
