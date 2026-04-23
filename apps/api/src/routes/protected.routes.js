import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeRole } from "../middleware/authorize-role.js";
import { grantTimedAccess } from "../lib/access-service.js";
import { resolvePostLoginRoute } from "../lib/access-routing.js";
import {
  requireDashboardAccess,
  requireDemoAccess
} from "../middleware/access-gate.js";

const router = Router();

router.get("/admin", authenticate, authorizeRole("admin"), (req, res) => {
  return res.status(200).json({
    area: "admin",
    user: req.user
  });
});

router.get("/demo", authenticate, authorizeRole("user"), requireDemoAccess, (req, res) => {
  return res.status(200).json({
    area: "demo",
    user: req.user,
    unlockOffer: {
      price: 10,
      durationHours: 48,
      cta: "Unlock Full Access — $10 (48 hours)"
    },
    metrics: [
      {
        label: "Projected MRR",
        value: "$24,860",
        delta: "+18.4%",
        trend: "Quarter-on-quarter lift from expansion revenue"
      },
      {
        label: "At-risk revenue",
        value: "$3,420",
        delta: "-6.1%",
        trend: "Fewer accounts trending toward contraction"
      },
      {
        label: "Net revenue retention",
        value: "112%",
        delta: "+4 pts",
        trend: "Upsell motions outperforming churn drag"
      },
      {
        label: "Pipeline coverage",
        value: "3.8x",
        delta: "+0.7x",
        trend: "Healthy top-of-funnel for the next cycle"
      }
    ],
    analytics: [
      {
        title: "Revenue mix",
        detail: "62% subscriptions, 24% services, 14% expansion"
      },
      {
        title: "Best-performing segment",
        detail: "Mid-market SaaS grew 21% week over week"
      },
      {
        title: "Forecast confidence",
        detail: "88% of target backed by verified pipeline"
      }
    ],
    activity: [
      "New enterprise deal marked as 92% likely to close this week",
      "Expansion playbook triggered for 14 product-qualified accounts",
      "Collections issue resolved on two delayed invoices worth $1,180",
      "Churn watchlist dropped below the internal 5% alert threshold"
    ]
  });
});

router.get("/dashboard", authenticate, authorizeRole("user"), requireDashboardAccess, (req, res) => {
  return res.status(200).json({
    area: "dashboard",
    user: req.user
  });
});

router.post("/api/dev/unlock", authenticate, authorizeRole("user"), async (req, res, next) => {
  try {
    const user = await grantTimedAccess(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        hasAccess: user.hasAccess,
        subscription_expires_at: user.subscription_expires_at,
        createdAt: user.createdAt
      },
      redirectTo: resolvePostLoginRoute(user)
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
