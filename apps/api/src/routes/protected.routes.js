import { Router } from "express";
import { env } from "../config/env.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeRole } from "../middleware/authorize-role.js";
import {
  requireDashboardAccess,
  requireDemoAccess
} from "../middleware/access-gate.js";
import { sendSuccess } from "../utils/http.js";

const router = Router();

router.get("/admin", authenticate, authorizeRole("admin"), (req, res) => {
  return sendSuccess(res, 200, {
    area: "admin",
    user: req.user
  });
});

router.get("/demo", authenticate, authorizeRole("user"), requireDemoAccess, (req, res) => {
  return sendSuccess(res, 200, {
    area: "demo",
    user: req.user,
    unlockOffer: {
      provider: "Whop",
      cta: "Choose a Whop plan to unlock live access"
    },
    plans: [
      {
        id: "plan_g5k8i3tfPkASV",
        label: "Emergency",
        price: 10,
        durationHours: 48
      },
      {
        id: "plan_pJpWvIqcYCRvV",
        label: "Tier 1",
        price: 199,
        durationDays: 30
      },
      {
        id: "plan_rE4Rj9g9t8RNH",
        label: "Tier 2",
        price: 399,
        durationDays: 30
      },
      {
        id: "plan_My5qZYNCRlcgr",
        label: "Tier 3",
        price: 799,
        durationDays: 30
      }
    ],
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
  return sendSuccess(res, 200, {
    area: "dashboard",
    user: req.user,
    evidence: {
      fingerprintApiKey: env.FINGERPRINT_API_KEY ?? null
    }
  });
});

export default router;
