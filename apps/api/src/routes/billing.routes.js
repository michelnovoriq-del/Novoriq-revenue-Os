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
} from "../lib/billing-service.js";

const router = Router();

const markPaidSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID")
});

router.post("/api/billing/run", authenticate, authorizeRole("admin"), async (req, res, next) => {
  try {
    const result = await runBillingCycle();
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

router.post("/api/admin/mark-paid", authenticate, authorizeRole("admin"), async (req, res, next) => {
  try {
    const { userId } = markPaidSchema.parse(req.body);
    const user = await markUserBalancePaid(userId);

    return res.status(200).json({
      userId: user.id,
      unpaidPerformanceBalance: user.unpaidPerformanceBalance
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/api/admin/overview", authenticate, authorizeRole("admin"), async (req, res, next) => {
  try {
    const overview = await getAdminOverview();
    return res.status(200).json(overview);
  } catch (error) {
    return next(error);
  }
});

router.get("/api/admin/users", authenticate, authorizeRole("admin"), async (req, res, next) => {
  try {
    const users = await getAdminUsers();
    return res.status(200).json({ users });
  } catch (error) {
    return next(error);
  }
});

router.get("/api/user/metrics", authenticate, authorizeRole("user"), async (req, res, next) => {
  try {
    const metrics = await getClientMetrics(req.user.id);
    return res.status(200).json(metrics);
  } catch (error) {
    return next(error);
  }
});

export default router;
