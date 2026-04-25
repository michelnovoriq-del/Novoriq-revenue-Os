import express, { Router } from "express";
import {
  queueWhopWebhookProcessing,
  verifyWhopWebhookSignature
} from "../services/whop-service.js";
import { sendError, sendSuccess } from "../utils/http.js";
import { logger } from "../utils/logger.js";

const router = Router();

router.post(
  "/api/whop/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";

    if (!verifyWhopWebhookSignature({ headers: req.headers, rawBody })) {
      return res.sendStatus(401);
    }

    let parsedBody = null;

    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      return sendError(res, 400, "Invalid JSON payload");
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
