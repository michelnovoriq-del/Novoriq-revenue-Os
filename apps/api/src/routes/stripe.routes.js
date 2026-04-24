import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  processStoredStripeEvent,
  storeStripeWebhookEvent,
  verifyStripeWebhookRequest
} from "../services/stripe-service.js";
import { asyncHandler, sendSuccess } from "../utils/http.js";
import { logger } from "../utils/logger.js";

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
    success: false,
    error: "Too many webhook requests. Please try again later."
  }
});

router.post(
  "/api/stripe/webhook/:userId",
  stripeWebhookLimiter,
  express.raw({ type: "application/json", limit: "1mb" }),
  asyncHandler(async (req, res) => {
    const { userId } = stripeWebhookParamsSchema.parse(req.params);

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

    sendSuccess(
      res,
      200,
      duplicate
        ? { received: true, duplicate: true, eventId, eventType }
        : { received: true, eventId, eventType }
    );

    if (!duplicate) {
      queueMicrotask(() => {
        processStoredStripeEvent({
          stripeEventId: storedWebhookEvent.event?.id,
          userId: user.id,
          event
        }).catch((error) => {
          logger.error("Stored Stripe event failed after acknowledgement", {
            userId: user.id,
            eventId,
            eventType,
            message: error.message
          });
        });
      });
    }
  })
);

export default router;
