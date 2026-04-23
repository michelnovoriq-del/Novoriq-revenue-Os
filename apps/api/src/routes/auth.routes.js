import { Router } from "express";
import rateLimit from "express-rate-limit";
import { REFRESH_COOKIE_NAME } from "../constants/auth.js";
import { clearAuthCookies, setAuthCookies } from "../lib/cookies.js";
import {
  getUserSession,
  loginUser,
  logoutUser,
  refreshUserSession,
  registerUser
} from "../lib/auth-service.js";
import { authenticate } from "../middleware/authenticate.js";
import { loginSchema, registerSchema } from "../validators/auth-schemas.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many login attempts. Please try again later."
  }
});

router.post("/register", async (req, res, next) => {
  try {
    const { email, password } = registerSchema.parse(req.body);
    const result = await registerUser({ email, password });

    setAuthCookies(res, result.accessToken, result.refreshToken);

    return res.status(201).json({
      user: result.user,
      redirectTo: result.redirectTo
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const credentials = loginSchema.parse(req.body);
    const result = await loginUser(credentials);

    setAuthCookies(res, result.accessToken, result.refreshToken);

    return res.status(200).json({
      user: result.user,
      redirectTo: result.redirectTo
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    await logoutUser(req.cookies[REFRESH_COOKIE_NAME]);
    clearAuthCookies(res);
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token missing" });
    }

    const result = await refreshUserSession(refreshToken);
    setAuthCookies(res, result.accessToken, result.refreshToken);

    return res.status(200).json({
      user: result.user,
      redirectTo: result.redirectTo
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const session = await getUserSession(req.user.id);

    if (!session) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json(session);
  } catch (error) {
    return next(error);
  }
});

export default router;
