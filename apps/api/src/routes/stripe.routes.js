import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env.js";
import {
  processStoredStripeEvent,
  storeStripeWebhookEvent,
  verifyStripeWebhookRequest
} from "../lib/stripe-service.js";

const router = Router();

const stripeWebhookParamsSchema = z.object({
  userId: z.string().uuid("Invalid user id")
});

const stripeWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many webhook requests. Please try again later."
  }
});

router.post(
  "/api/stripe/webhook/:userId",
  stripeWebhookLimiter,
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req, res, next) => {
    try {
      const { userId } = stripeWebhookParamsSchema.parse(req.params);
      const isHttps = req.secure || req.get("x-forwarded-proto") === "https";

      if (env.isProduction && !isHttps) {
        return res.status(400).json({ error: "HTTPS is required" });
      }

      const { user, event, eventId, eventType } = await verifyStripeWebhookRequest({
        userId,
        signature: req.get("stripe-signature"),
        rawBody: req.body
      });

      const storedWebhookEvent = await storeStripeWebhookEvent({
        userId: user.id,
        eventId,
        eventType,
        event
      });
      const { duplicate } = storedWebhookEvent;

      const responseBody = duplicate
        ? { received: true, duplicate: true, eventId, eventType }
        : { received: true, eventId, eventType };

      res.status(200).json(responseBody);

      if (!duplicate) {
        queueMicrotask(() => {
          processStoredStripeEvent({
            stripeEventId: storedWebhookEvent.event?.id,
            userId: user.id,
            event
          }).catch((error) => {
            console.error("[STRIPE WEBHOOK] Failed to process stored event.", {
              userId: user.id,
              eventId,
              eventType,
              message: error.message
            });
          });
        });
      }

      return undefined;
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
