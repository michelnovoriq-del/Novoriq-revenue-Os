import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      type: "access"
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`
    }
  );
}

export function signRefreshToken(user, sessionId) {
  return jwt.sign(
    {
      sub: user.id,
      sid: sessionId,
      type: "refresh"
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`
    }
  );
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (payload.type !== "access") {
    throw new Error("Invalid access token type");
  }

  return payload;
}

export function verifyRefreshToken(token) {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (payload.type !== "refresh") {
    throw new Error("Invalid refresh token type");
  }

  return payload;
}
