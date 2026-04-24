import crypto from "crypto";
import { env } from "../config/env.js";
import { getAccessExpiration, hasActiveAccess } from "./access-service.js";
import { findUserByEmail, updateUser } from "./user-store.js";
import {
  createWhopEvent,
  findProcessedWhopEvent,
  recordProcessedWhopEvent
} from "./whop-event-store.js";
import { logger } from "../utils/logger.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const ACTIVATION_IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;
const SUPPORTED_WHOP_EVENTS = new Set(["membership.activated", "payment.succeeded"]);

const WHOP_PLAN_CONFIG = {
  plan_g5k8i3tfPkASV: {
    subscriptionTier: "emergency",
    performanceFeePercentage: null,
    durationMs: 48 * HOUR_MS
  },
  plan_pJpWvIqcYCRvV: {
    subscriptionTier: "tier1",
    performanceFeePercentage: 0.1,
    durationMs: 30 * DAY_MS
  },
  plan_rE4Rj9g9t8RNH: {
    subscriptionTier: "tier2",
    performanceFeePercentage: 0.05,
    durationMs: 30 * DAY_MS
  },
  plan_My5qZYNCRlcgr: {
    subscriptionTier: "tier3",
    performanceFeePercentage: 0.03,
    durationMs: 30 * DAY_MS
  }
};

let hasWarnedAboutMissingSecret = false;
let processingQueue = Promise.resolve();

function getHeaderValue(headers, name) {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" ? value : null;
}

function getWebhookEventId(body, headers) {
  return getHeaderValue(headers, "webhook-id") ?? (typeof body?.id === "string" ? body.id : null);
}

function extractEmail(body) {
  const email =
    body?.data?.member?.email ??
    body?.data?.user?.email ??
    body?.data?.member?.user?.email ??
    null;

  return typeof email === "string" ? email.trim().toLowerCase() : null;
}

function extractPlanId(body) {
  const planId = body?.data?.plan_id ?? body?.data?.plan?.id ?? null;
  return typeof planId === "string" ? planId : null;
}

function extractPaymentId(body) {
  if (body?.type !== "payment.succeeded") {
    return null;
  }

  return typeof body?.data?.id === "string" ? body.data.id : null;
}

function extractMembershipId(body) {
  if (body?.type === "membership.activated") {
    return typeof body?.data?.id === "string" ? body.data.id : null;
  }

  return typeof body?.data?.membership?.id === "string" ? body.data.membership.id : null;
}

function decodeWebhookSecret(webhookSecret) {
  if (!webhookSecret) {
    return null;
  }

  if (!webhookSecret.startsWith("whsec_")) {
    return Buffer.from(webhookSecret, "utf8");
  }

  return Buffer.from(webhookSecret.slice("whsec_".length), "base64");
}

function verifyWhopWebhookSignature({ headers, rawBody }) {
  if (!env.WHOP_WEBHOOK_SECRET) {
    if (!hasWarnedAboutMissingSecret) {
      logger.warn("WHOP_WEBHOOK_SECRET is not configured. Signature verification is disabled.");
      hasWarnedAboutMissingSecret = true;
    }

    return true;
  }

  const webhookId = getHeaderValue(headers, "webhook-id");
  const webhookTimestamp = getHeaderValue(headers, "webhook-timestamp");
  const webhookSignature = getHeaderValue(headers, "webhook-signature");

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    logger.warn("Whop webhook missing signature headers.");
    return false;
  }

  const timestampSeconds = Number.parseInt(webhookTimestamp, 10);

  if (!Number.isFinite(timestampSeconds)) {
    logger.warn("Whop webhook timestamp is invalid.");
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > env.WHOP_WEBHOOK_TOLERANCE_SECONDS) {
    logger.warn("Whop webhook timestamp is outside tolerance.");
    return false;
  }

  const secret = decodeWebhookSecret(env.WHOP_WEBHOOK_SECRET);
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(signedContent).digest();

  return webhookSignature
    .split(" ")
    .map((signatureEntry) => signatureEntry.trim())
    .filter(Boolean)
    .some((signatureEntry) => {
      const [version, encodedSignature] = signatureEntry.split(",", 2);

      if (version !== "v1" || !encodedSignature) {
        return false;
      }

      const providedSignature = Buffer.from(encodedSignature, "base64");

      return (
        providedSignature.length === expectedSignature.length &&
        crypto.timingSafeEqual(providedSignature, expectedSignature)
      );
    });
}

function shouldSkipActivation(user, planConfig, nextAccessExpiration) {
  const currentAccessExpiration = getAccessExpiration(user);

  return (
    hasActiveAccess(user) &&
    user.subscriptionTier === planConfig.subscriptionTier &&
    currentAccessExpiration instanceof Date &&
    currentAccessExpiration.getTime() >=
      nextAccessExpiration.getTime() - ACTIVATION_IDEMPOTENCY_WINDOW_MS
  );
}

async function applyWhopAccess({
  body,
  email,
  eventId,
  eventType,
  planConfig,
  planId,
  user
}) {
  const processedAt = new Date();
  const accessExpiration = new Date(processedAt.getTime() + planConfig.durationMs);

  if (shouldSkipActivation(user, planConfig, accessExpiration)) {
    await recordProcessedWhopEvent({
      eventId,
      type: eventType,
      status: "duplicate_activation",
      processedAt,
      email,
      planId,
      userId: user.id,
      payload: {
        type: body?.type ?? null
      }
    });

    logger.info("Whop webhook skipped duplicate activation", {
      eventId,
      eventType,
      email,
      planId,
      userId: user.id
    });
    return;
  }

  const updatedUser = await updateUser(user.id, (currentUser) => ({
    ...currentUser,
    hasPaid: true,
    hasAccess: true,
    subscriptionTier: planConfig.subscriptionTier,
    performanceFeePercentage: planConfig.performanceFeePercentage,
    accessExpiration,
    subscription_expires_at: accessExpiration,
    whopLastEventId: eventId,
    whopLastEventType: eventType,
    whopLastPlanId: planId,
    whopLastPaymentId: extractPaymentId(body) ?? currentUser.whopLastPaymentId,
    whopLastMembershipId: extractMembershipId(body) ?? currentUser.whopLastMembershipId,
    whopLastProcessedAt: processedAt
  }));

  if (!updatedUser) {
    await recordProcessedWhopEvent({
      eventId,
      type: eventType,
      status: "missing_user",
      processedAt,
      email,
      planId
    });

    logger.warn("Whop webhook user disappeared before activation.", {
      eventId,
      email,
      planId
    });
    return;
  }

  await recordProcessedWhopEvent({
    eventId,
    type: eventType,
    status: "applied",
    processedAt,
    email,
    planId,
    userId: updatedUser.id
  });

  logger.info("Whop access activated", {
    eventId,
    eventType,
    email: updatedUser.email,
    userId: updatedUser.id,
    subscriptionTier: updatedUser.subscriptionTier,
    accessExpiration: accessExpiration.toISOString()
  });
}

async function processWhopWebhook({ body, headers, rawBody }) {
  const eventType = typeof body?.type === "string" ? body.type : "unknown";
  const eventId = getWebhookEventId(body, headers);

  if (!body || typeof body !== "object") {
    logger.warn("Whop webhook received an invalid payload.");
    return;
  }

  if (!eventId) {
    logger.warn("Whop webhook missing event id.", { eventType });
    return;
  }

  const createdEvent = await createWhopEvent({
    eventId,
    type: eventType,
    status: "processing",
    processedAt: new Date(),
    payload: {
      type: eventType
    }
  });

  if (!createdEvent) {
    const existingEvent = await findProcessedWhopEvent(eventId);

    logger.info("Whop webhook ignored duplicate event", {
      eventId,
      eventType,
      status: existingEvent?.status ?? "unknown"
    });
    return;
  }

  try {
    if (!verifyWhopWebhookSignature({ headers, rawBody })) {
      await recordProcessedWhopEvent({
        eventId,
        type: eventType,
        status: "rejected_signature",
        processedAt: new Date()
      });
      return;
    }

    if (!SUPPORTED_WHOP_EVENTS.has(eventType)) {
      await recordProcessedWhopEvent({
        eventId,
        type: eventType,
        status: "ignored",
        processedAt: new Date()
      });
      return;
    }

    const email = extractEmail(body);
    const planId = extractPlanId(body);

    if (!email || !planId) {
      await recordProcessedWhopEvent({
        eventId,
        type: eventType,
        status: "ignored_missing_data",
        processedAt: new Date(),
        email,
        planId
      });

      logger.warn("Whop webhook missing email or plan id.", {
        eventId,
        eventType,
        email,
        planId
      });
      return;
    }

    const planConfig = WHOP_PLAN_CONFIG[planId];
    if (!planConfig) {
      await recordProcessedWhopEvent({
        eventId,
        type: eventType,
        status: "ignored_unknown_plan",
        processedAt: new Date(),
        email,
        planId
      });

      logger.warn("Whop webhook ignored unknown plan.", {
        eventId,
        eventType,
        email,
        planId
      });
      return;
    }

    const user = await findUserByEmail(email);
    if (!user) {
      await recordProcessedWhopEvent({
        eventId,
        type: eventType,
        status: "missing_user",
        processedAt: new Date(),
        email,
        planId
      });

      logger.warn("Whop webhook did not find a matching user.", {
        eventId,
        eventType,
        email,
        planId
      });
      return;
    }

    await applyWhopAccess({
      body,
      email,
      eventId,
      eventType,
      planConfig,
      planId,
      user
    });
  } catch (error) {
    await recordProcessedWhopEvent({
      eventId,
      type: eventType,
      status: "failed",
      processedAt: new Date(),
      reason: error.message
    });

    logger.error("Whop webhook processing failed", {
      eventId,
      eventType,
      message: error.message
    });

    throw error;
  }
}

export function queueWhopWebhookProcessing(payload) {
  processingQueue = processingQueue
    .then(() => processWhopWebhook(payload))
    .catch((error) => {
      logger.error("Whop webhook queue failed", {
        message: error.message
      });
    });
}
