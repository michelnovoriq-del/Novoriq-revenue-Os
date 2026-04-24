import express, { Router } from "express";
import { queueWhopWebhookProcessing } from "../lib/whop-service.js";

const router = Router();

router.post(
  "/api/whop/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";

    try {
      req.body = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      req.body = null;
    }

    console.log(req.body);

    res.status(200).json({ received: true });

    setImmediate(() => {
      queueWhopWebhookProcessing({
        body: req.body,
        headers: req.headers,
        rawBody
      });
    });
  }
);

export default router;
