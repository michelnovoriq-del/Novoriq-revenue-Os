import { ACCESS_COOKIE_NAME } from "../constants/auth.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { findUserById } from "../lib/user-store.js";

export async function authenticate(req, res, next) {
  const token = req.cookies[ACCESS_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await findUserById(payload.sub);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      hasAccess: user.hasAccess,
      subscription_expires_at: user.subscription_expires_at,
      createdAt: user.createdAt
    };

    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}
