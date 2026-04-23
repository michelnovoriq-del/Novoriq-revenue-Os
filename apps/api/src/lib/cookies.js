import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from "../constants/auth.js";
import { env } from "../config/env.js";

function baseCookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "strict",
    path: "/",
    maxAge
  };
}

export function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie(
    ACCESS_COOKIE_NAME,
    accessToken,
    baseCookieOptions(env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000)
  );
  res.cookie(
    REFRESH_COOKIE_NAME,
    refreshToken,
    baseCookieOptions(env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
  );
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE_NAME, baseCookieOptions(0));
  res.clearCookie(REFRESH_COOKIE_NAME, baseCookieOptions(0));
}
