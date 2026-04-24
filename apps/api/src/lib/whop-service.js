import crypto from "crypto";
import { env } from "../config/env.js";
import { getAccessExpiration, hasActiveAccess } from "./access-service.js";
import { findUserByEmail, updateUser } from "./user-store.js";
import {
  findProcessedWhopEvent,
  recordProcessedWhopEvent
} from "./whop-event-store.js";

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
      console.warn(
        "[WHOP WEBHOOK] WHOP_WEBHOOK_SECRET is not configured. Signature verification is disabled."
      );
      hasWarnedAboutMissingSecret = true;
    }

    return true;
  }

  const webhookId = getHeaderValue(headers, "webhook-id");
  const webhookTimestamp = getHeaderValue(headers, "webhook-timestamp");
  const webhookSignature = getHeaderValue(headers, "webhook-signature");

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    console.warn("[WHOP WEBHOOK] Missing signature headers.");
    return false;
  }

  const timestampSeconds = Number.parseInt(webhookTimestamp, 10);

  if (!Number.isFinite(timestampSeconds)) {
    console.warn("[WHOP WEBHOOK] Invalid webhook timestamp.");
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > env.WHOP_WEBHOOK_TOLERANCE_SECONDS) {
    console.warn("[WHOP WEBHOOK] Webhook timestamp is outside the accepted tolerance window.");
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
  const processedAt = Date.now();
  const accessExpiration = new Date(processedAt + planConfig.durationMs);

  if (shouldSkipActivation(user, planConfig, accessExpiration)) {
    await recordProcessedWhopEvent({
      eventId,
      type: eventType,
      status: "duplicate_activation",
      processedAt,
      email,
      planId,
      userId: user.id
    });

    console.log(
      `[WHOP WEBHOOK] Skipping duplicate activation for ${email} on ${planConfig.subscriptionTier}.`
    );
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
    whopLastProcessedAt: new Date(processedAt)
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

    console.warn(`[WHOP WEBHOOK] User disappeared before activation for ${email}.`);
    return;
  }

  await recordProcessedWhopEvent({
    eventId,
    type: eventType,
    status: "applied",
    processedAt,
    email,
    planId,
    userId: updatedUser.id,
    subscriptionTier: updatedUser.subscriptionTier,
    accessExpiration
  });

  console.log(
    `[WHOP WEBHOOK] Activated ${updatedUser.subscriptionTier} for ${updatedUser.email} until ${new Date(
      accessExpiration
    ).toISOString()}.`
  );
}

async function processWhopWebhook({ body, headers, rawBody }) {
  const eventType = typeof body?.type === "string" ? body.type : "unknown";
  const eventId = getWebhookEventId(body, headers);

  try {
    if (!body || typeof body !== "object") {
      console.warn("[WHOP WEBHOOK] Received an invalid JSON payload.");
      return;
    }

    if (!eventId) {
      console.warn("[WHOP WEBHOOK] Missing webhook event id.");
      return;
    }

    const existingEvent = await findProcessedWhopEvent(eventId);
    if (existingEvent) {
      console.log(`[WHOP WEBHOOK] Ignoring already processed event ${eventId}.`);
      return;
    }

    if (!verifyWhopWebhookSignature({ headers, rawBody })) {
      await recordProcessedWhopEvent({
        eventId,
        type: eventType,
        status: "rejected_signature",
        processedAt: Date.now()
      });
      return;
    }

    if (!SUPPORTED_WHOP_EVENTS.has(eventType)) {
      await recordProcessedWhopEvent({
        eventId,
        type: eventType,
        status: "ignored",
        processedAt: Date.now()
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
        processedAt: Date.now(),
        email,
        planId
      });

      console.warn(
        `[WHOP WEBHOOK] Missing email or plan id for ${eventType}. Email: ${email}, Plan: ${planId}`
      );
      return;
    }

    const planConfig = WHOP_PLAN_CONFIG[planId];
    if (!planConfig) {
      await recordProcessedWhopEvent({
        eventId,
        type: eventType,
        status: "ignored_unknown_plan",
        processedAt: Date.now(),
        email,
        planId
      });

      console.warn(`[WHOP WEBHOOK] Ignoring unknown Whop plan ${planId}.`);
      return;
    }

    const user = await findUserByEmail(email);
    if (!user) {
      await recordProcessedWhopEvent({
        eventId,
        type: eventType,
        status: "missing_user",
        processedAt: Date.now(),
        email,
        planId
      });

      console.warn(`[WHOP WEBHOOK] No matching user found for ${email}.`);
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
    if (eventId) {
      await recordProcessedWhopEvent({
        eventId,
        type: eventType,
        status: "failed",
        processedAt: Date.now(),
        reason: error.message
      });
    }

    throw error;
  }
}

export function queueWhopWebhookProcessing(payload) {
  processingQueue = processingQueue
    .then(() => processWhopWebhook(payload))
    .catch((error) => {
      console.error("[WHOP WEBHOOK] Failed to process webhook.", error);
    });
}
