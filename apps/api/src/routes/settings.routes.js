import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeRole } from "../middleware/authorize-role.js";
import { storeRestrictedStripeKey } from "../lib/stripe-service.js";

const router = Router();

const settingsKeySchema = z.object({
  restrictedKey: z
    .string()
    .trim()
    .min(1, "Restricted Stripe API key is required")
    .regex(/^rk_/, "Only Stripe restricted API keys are accepted"),
  webhookSecret: z
    .string()
    .trim()
    .regex(/^whsec_/, "Stripe webhook endpoint secret must start with whsec_")
    .optional()
});

router.post(
  "/api/settings/keys",
  authenticate,
  authorizeRole("user"),
  async (req, res, next) => {
    try {
      let { restrictedKey, webhookSecret } = settingsKeySchema.parse(req.body);
      const result = await storeRestrictedStripeKey({
        userId: req.user.id,
        restrictedKey,
        webhookSecret
      });

      restrictedKey = "";
      webhookSecret = "";

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
