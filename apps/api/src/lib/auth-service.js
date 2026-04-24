import { createSessionId, createUserId } from "./id.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./jwt.js";
import { comparePassword, hashPassword } from "./password.js";
import { hashToken } from "./token-hash.js";
import { createSession, deleteSession, findSessionById } from "./session-store.js";
import { createUser, findUserByEmail, findUserById } from "./user-store.js";
import { env } from "../config/env.js";
import { resolvePostLoginRoute } from "./access-routing.js";
import { USER_ROLES } from "../constants/auth.js";

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    hasPaid: user.hasPaid,
    hasAccess: user.hasAccess,
    subscriptionTier: user.subscriptionTier,
    performanceFeePercentage: user.performanceFeePercentage,
    unpaidPerformanceBalance: user.unpaidPerformanceBalance,
    totalRecoveredRevenue: user.totalRecoveredRevenue,
    accessExpiration: user.accessExpiration,
    subscription_expires_at: user.subscription_expires_at,
    stripeConfigured: user.stripeConfigured,
    createdAt: user.createdAt
  };
}

async function issueTokensForUser(user) {
  const sessionId = createSessionId();
  const refreshToken = signRefreshToken(user, sessionId);
  const accessToken = signAccessToken(user);

  await createSession({
    id: sessionId,
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    createdAt: Date.now()
  });

  return { accessToken, refreshToken };
}

export async function registerUser({ email, password }) {
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    const error = new Error("Email is already registered");
    error.statusCode = 409;
    throw error;
  }

  const password_hash = await hashPassword(password);

  const user = await createUser({
    id: createUserId(),
    email,
    password_hash,
    role: USER_ROLES.USER,
    hasPaid: false,
    hasAccess: false,
    subscriptionTier: null,
    performanceFeePercentage: null,
    unpaidPerformanceBalance: 0,
    totalRecoveredRevenue: 0,
    accessExpiration: null,
    subscription_expires_at: null,
    stripeRestrictedKey: null,
    createdAt: Date.now()
  });

  const tokens = await issueTokensForUser(user);

  return {
    user: sanitizeUser(user),
    redirectTo: resolvePostLoginRoute(user),
    ...tokens
  };
}

export async function loginUser({ email, password }) {
  const user = await findUserByEmail(email);
  if (!user) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  const passwordMatches = await comparePassword(password, user.password_hash);
  if (!passwordMatches) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  const tokens = await issueTokensForUser(user);

  return {
    user: sanitizeUser(user),
    redirectTo: resolvePostLoginRoute(user),
    ...tokens
  };
}

export async function getUserSession(userId) {
  const user = await findUserById(userId);
  if (!user) {
    return null;
  }

  return {
    user: sanitizeUser(user),
    redirectTo: resolvePostLoginRoute(user)
  };
}

export async function refreshUserSession(refreshToken) {
  const payload = verifyRefreshToken(refreshToken);
  const session = await findSessionById(payload.sid);

  if (!session || session.userId !== payload.sub) {
    const error = new Error("Invalid refresh session");
    error.statusCode = 401;
    throw error;
  }

  if (session.expiresAt <= Date.now()) {
    await deleteSession(session.id);
    const error = new Error("Refresh session expired");
    error.statusCode = 401;
    throw error;
  }

  if (session.tokenHash !== hashToken(refreshToken)) {
    await deleteSession(session.id);
    const error = new Error("Refresh token mismatch");
    error.statusCode = 401;
    throw error;
  }

  const user = await findUserById(payload.sub);
  if (!user) {
    await deleteSession(session.id);
    const error = new Error("User not found");
    error.statusCode = 401;
    throw error;
  }

  await deleteSession(session.id);
  const tokens = await issueTokensForUser(user);

  return {
    user: sanitizeUser(user),
    redirectTo: resolvePostLoginRoute(user),
    ...tokens
  };
}

export async function logoutUser(refreshToken) {
  if (!refreshToken) {
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    await deleteSession(payload.sid);
  } catch {
    return;
  }
}
