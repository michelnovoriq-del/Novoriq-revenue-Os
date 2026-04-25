import Stripe from "stripe";
import { env } from "../config/env.js";
import { hasActiveAccess } from "./access-service.js";
import {
  createRecoveryLog,
  findEvidenceByChargeId,
  findLatestEvidenceSessionByUserId,
  getDisputeEvidenceBundle,
  hasRecoveryLogForDispute,
  upsertEvidence
} from "./evidence-store.js";
import {
  notifyDisputeTriggered,
  notifyDisputeWon,
  notifyEvidenceSubmitted
} from "./dispute-notifier.js";
import {
  createStripeEvent,
  findStripeEventByEventId,
  markStripeEventFailed,
  markStripeEventProcessed,
  markStripeEventProcessingStarted
} from "./stripe-event-store.js";
import {
  clearSensitiveBuffer,
  decryptToBuffer,
  decrypt,
  encrypt
} from "./secret-encryption.js";
import { calculateFeeCents, centsToDollars } from "./money.js";
import { findUserById, updateUser } from "./user-store.js";
import { createHttpError } from "../utils/http.js";
import { logger } from "../utils/logger.js";

const stripeWebhookVerifier = new Stripe("sk_test_webhook_verifier", {
  apiVersion: "2025-03-31.basil"
});

function normalizeRestrictedKey(restrictedKey) {
  return typeof restrictedKey === "string" ? restrictedKey.trim() : "";
}

function normalizeWebhookSecret(webhookSecret) {
  return typeof webhookSecret === "string" ? webhookSecret.trim() : "";
}

function getStripeClient(apiKey) {
  return new Stripe(apiKey, {
    apiVersion: "2025-03-31.basil"
  });
}

function getChargeFromEvent(event) {
  return event?.data?.object ?? null;
}

function getDisputeFromEvent(event) {
  return event?.data?.object ?? null;
}

function getChargeTimestamp(charge) {
  const timestampSeconds = typeof charge?.created === "number" ? charge.created : null;
  return timestampSeconds ? new Date(timestampSeconds * 1000) : null;
}

function resolveStripeWebhookSecret(user) {
  let userScopedSecret = "";

  if (user?.webhookSecret) {
    try {
      userScopedSecret = normalizeWebhookSecret(decrypt(user.webhookSecret));
    } catch {
      userScopedSecret = normalizeWebhookSecret(user.webhookSecret);
    }
  }

  const environmentSecret = normalizeWebhookSecret(env.STRIPE_WEBHOOK_SECRET);
  const webhookSecret = userScopedSecret || environmentSecret;

  if (!webhookSecret) {
    throw createHttpError(500, "Stripe webhook secret is not configured");
  }

  if (!webhookSecret.startsWith("whsec_")) {
    throw createHttpError(500, "Stripe webhook secret format is invalid");
  }

  return webhookSecret;
}

function verifyRestrictedKeyError(error) {
  const permissionErrorCodes = new Set([
    "permission_denied",
    "secret_key_required",
    "insufficient_permissions"
  ]);

  if (error?.type === "StripeAuthenticationError") {
    throw createHttpError(400, "Invalid Stripe restricted API key");
  }

  if (error?.type === "StripePermissionError" || permissionErrorCodes.has(error?.code)) {
    throw createHttpError(
      400,
      "Stripe restricted key is missing the dispute permissions required by this integration"
    );
  }

  throw createHttpError(400, "Unable to validate Stripe restricted API key");
}

function formatActivityMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return "";
  }

  return Object.entries(metadata)
    .slice(0, 5)
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(", ");
}

function buildAccessActivityLog(bundle) {
  const parts = [];

  if (bundle.session?.fingerprintId) {
    parts.push(`Fingerprint: ${bundle.session.fingerprintId}`);
  }

  if (bundle.session?.ipAddress) {
    parts.push(`Session IP: ${bundle.session.ipAddress}`);
  }

  if (bundle.session?.city || bundle.session?.country) {
    parts.push(`Geo: ${[bundle.session.city, bundle.session.country].filter(Boolean).join(", ")}`);
  }

  if (bundle.evidence?.chargeTimestamp) {
    parts.push(`Charge timestamp: ${bundle.evidence.chargeTimestamp.toISOString()}`);
  }

  if (Array.isArray(bundle.activityLogs) && bundle.activityLogs.length > 0) {
    const activityLines = bundle.activityLogs.slice(0, 20).map((activityLog) => {
      const metadataSummary = formatActivityMetadata(activityLog.metadata);
      const timestamp = activityLog.createdAt ? activityLog.createdAt.toISOString() : "unknown";
      return metadataSummary
        ? `${timestamp} ${activityLog.action} (${metadataSummary})`
        : `${timestamp} ${activityLog.action}`;
    });

    parts.push(`Activity: ${activityLines.join(" | ")}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "No access activity captured";
}

function buildDisputeEvidencePayload(bundle) {
  const sessionIp = bundle.session?.ipAddress || bundle.evidence?.receiptIp || "";
  const payload = {
    access_activity_log: buildAccessActivityLog(bundle)
  };

  if (bundle.user?.email) {
    payload.customer_email_address = bundle.user.email;
  }

  if (sessionIp) {
    payload.customer_ip_address = sessionIp;
    payload.customer_purchase_ip = sessionIp;
  }

  return payload;
}

function getPerformanceFeeRate(user) {
  switch ((user?.subscriptionTier || "").toLowerCase()) {
    case "tier1":
      return 0.1;
    case "tier2":
      return 0.05;
    case "tier3":
      return 0.03;
    default:
      return typeof user?.performanceFeePercentage === "number" ? user.performanceFeePercentage : 0;
  }
}

export function buildStripeWebhookUrl(userId) {
  return new URL(`/api/stripe/webhook/${userId}`, env.APP_BASE_URL).toString();
}

export async function validateRestrictedStripeKey(restrictedKey) {
  const normalizedKey = normalizeRestrictedKey(restrictedKey);

  if (!normalizedKey.startsWith("rk_")) {
    throw createHttpError(400, "Only Stripe restricted API keys are accepted");
  }

  try {
    const stripe = getStripeClient(normalizedKey);
    await stripe.disputes.list({ limit: 1 });
  } catch (error) {
    verifyRestrictedKeyError(error);
  }

  return normalizedKey;
}

export async function storeRestrictedStripeKey({ userId, restrictedKey, webhookSecret }) {
  const validatedKey = await validateRestrictedStripeKey(restrictedKey);
  const normalizedWebhookSecret = normalizeWebhookSecret(webhookSecret);
  const encryptedKey = encrypt(validatedKey);
  const encryptedWebhookSecret = normalizedWebhookSecret ? encrypt(normalizedWebhookSecret) : undefined;
  const user = await updateUser(userId, (currentUser) => ({
    ...currentUser,
    stripeRestrictedKey: encryptedKey,
    webhookSecret: encryptedWebhookSecret ?? currentUser.webhookSecret
  }));

  if (!user) {
    throw createHttpError(404, "User not found");
  }

  return {
    webhookUrl: buildStripeWebhookUrl(user.id)
  };
}

async function handleChargeSucceeded({ userId, event }) {
  const charge = getChargeFromEvent(event);
  const chargeId = typeof charge?.id === "string" ? charge.id : null;

  if (!chargeId) {
    throw createHttpError(422, "charge.succeeded event is missing charge.id");
  }

  const latestSession = await findLatestEvidenceSessionByUserId(userId);

  await upsertEvidence({
    userId,
    sessionId: latestSession?.id ?? null,
    chargeId,
    receiptIp: typeof charge?.receipt_ip === "string" ? charge.receipt_ip : latestSession?.ipAddress ?? "",
    chargeTimestamp: getChargeTimestamp(charge) ?? new Date()
  });
}

async function withDecryptedStripe(user, callback) {
  if (!user.stripeRestrictedKey) {
    throw createHttpError(409, "Stripe restricted key has not been configured");
  }

  let decryptedKeyBuffer = null;

  try {
    decryptedKeyBuffer = decryptToBuffer(user.stripeRestrictedKey);
    const stripe = getStripeClient(decryptedKeyBuffer.toString("utf8"));
    return await callback(stripe);
  } finally {
    clearSensitiveBuffer(decryptedKeyBuffer);
    decryptedKeyBuffer = null;
  }
}

async function handleChargeDisputeCreated({ user, event }) {
  if (!user) {
    throw createHttpError(404, "User not found");
  }

  if (!hasActiveAccess(user)) {
    throw createHttpError(401, "User access has expired");
  }

  const dispute = getDisputeFromEvent(event);
  const disputeId = typeof dispute?.id === "string" ? dispute.id : null;
  const chargeId = typeof dispute?.charge === "string" ? dispute.charge : null;

  if (!disputeId || !chargeId) {
    throw createHttpError(422, "charge.dispute.created event is missing dispute or charge ids");
  }

  const bundle = await getDisputeEvidenceBundle(chargeId);
  if (!bundle?.evidence) {
    throw createHttpError(404, "No evidence found for the disputed charge");
  }

  if (
    bundle.evidence.disputeId === disputeId &&
    bundle.evidence.disputeStatus === "submitted"
  ) {
    return;
  }

  await notifyDisputeTriggered({
    userId: user.id,
    userEmail: bundle.user?.email ?? user.email,
    disputeId,
    chargeId
  });

  await withDecryptedStripe(user, async (stripe) => {
    await stripe.disputes.update(disputeId, {
      evidence: buildDisputeEvidencePayload(bundle)
    });
  });

  await upsertEvidence({
    userId: user.id,
    sessionId: bundle.evidence.sessionId,
    chargeId,
    disputeId,
    disputeStatus: "submitted",
    recoveredAmountCents: bundle.evidence.recoveredAmountCents,
    receiptIp: bundle.evidence.receiptIp,
    chargeTimestamp: bundle.evidence.chargeTimestamp
  });

  await notifyEvidenceSubmitted({
    userId: user.id,
    userEmail: bundle.user?.email ?? user.email,
    disputeId,
    chargeId
  });
}

async function handleChargeDisputeClosed({ user, event }) {
  if (!user) {
    throw createHttpError(404, "User not found");
  }

  const dispute = getDisputeFromEvent(event);
  const disputeId = typeof dispute?.id === "string" ? dispute.id : null;
  const chargeId = typeof dispute?.charge === "string" ? dispute.charge : null;
  const disputeStatus = typeof dispute?.status === "string" ? dispute.status : null;

  if (!disputeId || !chargeId || !disputeStatus) {
    throw createHttpError(422, "charge.dispute.closed event is missing dispute fields");
  }

  const evidence = await findEvidenceByChargeId(chargeId);
  if (!evidence) {
    throw createHttpError(404, "No evidence found for the disputed charge");
  }

  if (disputeStatus === "won" && typeof dispute?.amount !== "number") {
    throw createHttpError(422, "charge.dispute.closed event is missing dispute.amount");
  }

  const recoveredAmountCents =
    disputeStatus === "won" && typeof dispute?.amount === "number"
      ? Math.max(0, Math.round(dispute.amount))
      : null;

  await upsertEvidence({
    userId: user.id,
    sessionId: evidence.sessionId,
    chargeId,
    disputeId,
    disputeStatus,
    recoveredAmountCents,
    receiptIp: evidence.receiptIp,
    chargeTimestamp: evidence.chargeTimestamp
  });

  if (disputeStatus !== "won") {
    return;
  }

  const alreadyLogged = await hasRecoveryLogForDispute(disputeId);
  if (alreadyLogged) {
    return;
  }

  const platformFeeCents = calculateFeeCents(
    recoveredAmountCents,
    getPerformanceFeeRate(user)
  );

  await createRecoveryLog({
    userId: user.id,
    chargeId,
    disputeId,
    recoveredAmountCents,
    platformFeeCents
  });

  await notifyDisputeWon({
    userId: user.id,
    userEmail: user.email,
    disputeId,
    chargeId,
    recoveredAmount: centsToDollars(recoveredAmountCents),
    recoveredAmountCents,
    platformFee: centsToDollars(platformFeeCents),
    platformFeeCents
  });
}

export async function verifyStripeWebhookRequest({ userId, signature, rawBody }) {
  const user = await findUserById(userId);

  if (!user) {
    throw createHttpError(404, "User not found");
  }

  if (!signature) {
    throw createHttpError(400, "Missing Stripe-Signature header");
  }

  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    throw createHttpError(400, "Stripe webhook raw body is required");
  }

  let event;

  try {
    event = stripeWebhookVerifier.webhooks.constructEvent(
      rawBody,
      signature,
      resolveStripeWebhookSecret(user),
      env.STRIPE_WEBHOOK_TOLERANCE_SECONDS
    );
  } catch (error) {
    throw createHttpError(400, `Invalid Stripe webhook signature: ${error.message}`);
  }

  const eventId = typeof event?.id === "string" ? event.id : null;
  const eventType = typeof event?.type === "string" ? event.type : null;

  if (!eventId || !eventType) {
    throw createHttpError(400, "Stripe event must include id and type");
  }

  return {
    user,
    event,
    eventId,
    eventType
  };
}

export async function storeStripeWebhookEvent({ userId, eventId, eventType, event }) {
  const existingEvent = await findStripeEventByEventId(eventId);
  if (existingEvent) {
    return {
      duplicate: true,
      event: existingEvent
    };
  }

  const storedEvent = await createStripeEvent({
    userId,
    eventId,
    eventType,
    payload: event
  });

  if (!storedEvent) {
    return {
      duplicate: true,
      event: existingEvent
    };
  }

  return {
    duplicate: false,
    event: storedEvent
  };
}

export async function processStoredStripeEvent({ stripeEventId, userId, event }) {
  const user = await findUserById(userId);

  if (!user) {
    throw createHttpError(404, "User not found");
  }

  const eventType = typeof event?.type === "string" ? event.type : null;

  if (!eventType) {
    throw createHttpError(400, "Stripe event must include type");
  }

  if (stripeEventId) {
    const storedEvent = await markStripeEventProcessingStarted(stripeEventId);

    if (storedEvent?.processingStatus !== "processing") {
      logger.info("Stripe event skipped because it is no longer processable", {
        stripeEventId,
        eventType
      });
      return;
    }
  }

  try {
    switch (eventType) {
      case "charge.succeeded":
        await handleChargeSucceeded({ userId: user.id, event });
        break;
      case "charge.dispute.created":
        await handleChargeDisputeCreated({ user, event });
        break;
      case "charge.dispute.closed":
        await handleChargeDisputeClosed({ user, event });
        break;
      default:
        break;
    }

    if (stripeEventId) {
      await markStripeEventProcessed(stripeEventId);
    }
  } catch (error) {
    if (stripeEventId) {
      await markStripeEventFailed(stripeEventId, error.message);
    }

    logger.error("Stripe event processing failed", {
      stripeEventId,
      userId,
      eventType,
      message: error.message
    });

    throw error;
  }
}
