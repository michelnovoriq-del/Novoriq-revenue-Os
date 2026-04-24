import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeRole } from "../middleware/authorize-role.js";
import {
  getAdminOverview,
  getAdminUsers,
  getClientMetrics,
  markUserBalancePaid,
  runBillingCycle
} from "../services/billing-service.js";
import { asyncHandler, sendSuccess } from "../utils/http.js";

const router = Router();

const markPaidSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID")
});

router.post("/api/billing/run", authenticate, authorizeRole("admin"), asyncHandler(async (req, res) => {
    const result = await runBillingCycle();
    return sendSuccess(res, 200, result);
  }));

router.post("/api/admin/mark-paid", authenticate, authorizeRole("admin"), asyncHandler(async (req, res) => {
    const { userId } = markPaidSchema.parse(req.body);
    const user = await markUserBalancePaid(userId);

    return sendSuccess(res, 200, {
      userId: user.id,
      unpaidPerformanceBalance: user.unpaidPerformanceBalance
    });
  }));

router.get("/api/admin/overview", authenticate, authorizeRole("admin"), asyncHandler(async (req, res) => {
    const overview = await getAdminOverview();
    return sendSuccess(res, 200, overview);
  }));

router.get("/api/admin/users", authenticate, authorizeRole("admin"), asyncHandler(async (req, res) => {
    const users = await getAdminUsers();
    return sendSuccess(res, 200, { users });
  }));

router.get("/api/user/metrics", authenticate, authorizeRole("user"), asyncHandler(async (req, res) => {
    const metrics = await getClientMetrics(req.user.id);
    return sendSuccess(res, 200, metrics);
  }));

export default router;
