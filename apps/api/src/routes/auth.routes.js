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
} from "../services/auth-service.js";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler, sendError, sendSuccess } from "../utils/http.js";
import { loginSchema, registerSchema } from "../validators/auth-schemas.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many login attempts. Please try again later."
  }
});

router.post("/register", asyncHandler(async (req, res) => {
    const { email, password } = registerSchema.parse(req.body);
    const result = await registerUser({ email, password });

    setAuthCookies(res, result.accessToken, result.refreshToken);

    return sendSuccess(res, 201, {
      user: result.user,
      redirectTo: result.redirectTo
    });
  }));

router.post("/login", loginLimiter, asyncHandler(async (req, res) => {
    const credentials = loginSchema.parse(req.body);
    const result = await loginUser(credentials);

    setAuthCookies(res, result.accessToken, result.refreshToken);

    return sendSuccess(res, 200, {
      user: result.user,
      redirectTo: result.redirectTo
    });
  }));

router.post("/logout", asyncHandler(async (req, res) => {
    await logoutUser(req.cookies[REFRESH_COOKIE_NAME]);
    clearAuthCookies(res);
    return sendSuccess(res, 200);
  }));

router.post("/refresh", asyncHandler(async (req, res) => {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      return sendError(res, 401, "Refresh token missing");
    }

    const result = await refreshUserSession(refreshToken);
    setAuthCookies(res, result.accessToken, result.refreshToken);

    return sendSuccess(res, 200, {
      user: result.user,
      redirectTo: result.redirectTo
    });
  }));

router.get("/me", authenticate, asyncHandler(async (req, res) => {
    const session = await getUserSession(req.user.id);

    if (!session) {
      return sendError(res, 404, "User not found");
    }

    return sendSuccess(res, 200, session);
  }));

export default router;
