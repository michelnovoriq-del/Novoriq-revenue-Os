import express, { Router } from "express";
import { queueWhopWebhookProcessing } from "../services/whop-service.js";
import { sendSuccess } from "../utils/http.js";
import { logger } from "../utils/logger.js";

const router = Router();

router.post(
  "/api/whop/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
    let parsedBody = null;

    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsedBody = null;
    }

    sendSuccess(res, 200, { received: true });

    setImmediate(() => {
      logger.info("Whop webhook acknowledged", {
        eventId: req.get("webhook-id"),
        eventType: parsedBody?.type ?? "unknown"
      });

      queueWhopWebhookProcessing({
        body: parsedBody,
        headers: req.headers,
        rawBody
      });
    });
  }
);

export default router;
