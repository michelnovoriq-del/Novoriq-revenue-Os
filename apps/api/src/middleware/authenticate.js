import { ACCESS_COOKIE_NAME } from "../constants/auth.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { findUserById } from "../lib/user-store.js";
import { sendError } from "../utils/http.js";

export async function authenticate(req, res, next) {
  const token = req.cookies[ACCESS_COOKIE_NAME];

  if (!token) {
    return sendError(res, 401, "Authentication required");
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await findUserById(payload.sub);

    if (!user) {
      return sendError(res, 401, "User not found");
    }

    req.user = {
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

    next();
  } catch {
    return sendError(res, 401, "Invalid or expired access token");
  }
}
