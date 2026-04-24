import { updateUser } from "./user-store.js";

export const ACCESS_UNLOCK_WINDOW_MS = 48 * 60 * 60 * 1000;

function toDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function hasPaidAccess(user) {
  return user.hasPaid === true || user.hasAccess === true;
}

export function getAccessExpiration(user) {
  return toDate(user.accessExpiration ?? user.subscription_expires_at);
}

export function hasSubscriptionExpired(user) {
  const accessExpiration = getAccessExpiration(user);

  if (!accessExpiration) {
    return false;
  }

  return Date.now() >= accessExpiration.getTime();
}

export function hasActiveAccess(user) {
  return hasPaidAccess(user) && getAccessExpiration(user) !== null && !hasSubscriptionExpired(user);
}

export async function grantTimedAccess(userId, durationMs = ACCESS_UNLOCK_WINDOW_MS) {
  const accessExpiration = new Date(Date.now() + durationMs);

  return updateUser(userId, (currentUser) => ({
    ...currentUser,
    hasPaid: true,
    hasAccess: true,
    accessExpiration,
    subscription_expires_at: accessExpiration
  }));
}
