import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeRole } from "../middleware/authorize-role.js";
import { requireDashboardAccess } from "../middleware/access-gate.js";
import {
  captureEvidenceSession,
  extractClientIp,
  logEvidenceActivity
} from "../services/evidence-service.js";
import { asyncHandler, sendSuccess } from "../utils/http.js";

const router = Router();

const evidenceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many evidence requests. Please try again later."
  }
});

const evidenceSessionSchema = z.object({
  fingerprintId: z.string().trim().min(1, "fingerprintId is required").max(255),
  userAgent: z.string().trim().min(1, "userAgent is required").max(1000)
});

const evidenceActivitySchema = z.object({
  sessionId: z.string().trim().uuid("sessionId must be a valid UUID"),
  action: z.string().trim().min(1, "action is required").max(120),
  metadata: z.unknown().optional()
});

router.post(
  "/api/evidence/session",
  evidenceLimiter,
  authenticate,
  authorizeRole("user"),
  requireDashboardAccess,
  asyncHandler(async (req, res) => {
    const { fingerprintId, userAgent } = evidenceSessionSchema.parse(req.body);
    const session = await captureEvidenceSession({
      userId: req.user.id,
      fingerprintId,
      userAgent,
      ipAddress: extractClientIp(req)
    });

    return sendSuccess(res, 201, {
      sessionId: session.id
    });
  })
);

router.post(
  "/api/evidence/activity",
  evidenceLimiter,
  authenticate,
  authorizeRole("user"),
  requireDashboardAccess,
  asyncHandler(async (req, res) => {
    const { sessionId, action, metadata } = evidenceActivitySchema.parse(req.body);
    const activityLog = await logEvidenceActivity({
      userId: req.user.id,
      sessionId,
      action,
      metadata
    });

    return sendSuccess(res, 201, {
      activityLogId: activityLog.id
    });
  })
);

export default router;
