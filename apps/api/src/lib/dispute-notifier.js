import { env } from "../config/env.js";
import { formatCentsAsCurrency } from "./money.js";
import { logger } from "../utils/logger.js";

const RESEND_API_URL = "https://api.resend.com/emails";
const ALERT_FROM_EMAIL = "alerts@novoriq.local";
const OPS_EMAIL = "ops@novoriq.local";

async function sendNotification({ to, subject, text }) {
  if (!env.RESEND_API_KEY) {
    return;
  }

  try {
    await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: ALERT_FROM_EMAIL,
        to,
        subject,
        text
      })
    });
  } catch (error) {
    logger.error("Failed to send email notification.", {
      message: error.message
    });
  }
}

function buildRecipients(userEmail) {
  return userEmail ? [OPS_EMAIL, userEmail] : [OPS_EMAIL];
}

export async function notifyDisputeTriggered({ userId, userEmail, disputeId, chargeId }) {
  await sendNotification({
    to: buildRecipients(userEmail),
    subject: `Dispute triggered for ${chargeId}`,
    text: `Dispute ${disputeId} was triggered for user ${userId} and charge ${chargeId}.`
  });
}

export async function notifyEvidenceSubmitted({ userId, userEmail, disputeId, chargeId }) {
  await sendNotification({
    to: buildRecipients(userEmail),
    subject: `Evidence submitted for ${chargeId}`,
    text: `Evidence was submitted for dispute ${disputeId}, user ${userId}, charge ${chargeId}.`
  });
}

export async function notifyDisputeWon({
  userId,
  userEmail,
  disputeId,
  chargeId,
  recoveredAmount,
  recoveredAmountCents,
  platformFee,
  platformFeeCents
}) {
  const recoveredValue =
    typeof recoveredAmountCents === "number"
      ? formatCentsAsCurrency(recoveredAmountCents)
      : Number(recoveredAmount ?? 0).toFixed(2);
  const platformFeeValue =
    typeof platformFeeCents === "number"
      ? formatCentsAsCurrency(platformFeeCents)
      : Number(platformFee ?? 0).toFixed(2);

  await sendNotification({
    to: buildRecipients(userEmail),
    subject: `Recovered revenue for ${chargeId}`,
    text: `Dispute ${disputeId} was won for user ${userId}. Recovered amount: ${recoveredValue}. Platform fee: ${platformFeeValue}.`
  });
}

export async function notifyBillingRun({ userEmail, amountDue, amountDueCents, recoveryCount }) {
  const amountDueValue =
    typeof amountDueCents === "number"
      ? formatCentsAsCurrency(amountDueCents)
      : Number(amountDue ?? 0).toFixed(2);

  await sendNotification({
    to: buildRecipients(userEmail),
    subject: "Performance billing notice",
    text: `A billing run marked ${recoveryCount} recovery items for invoicing. Amount due: ${amountDueValue}.`
  });
}

export async function notifyPaymentConfirmation({ userEmail }) {
  await sendNotification({
    to: buildRecipients(userEmail),
    subject: "Payment confirmation",
    text: "Your outstanding performance balance has been marked as paid."
  });
}
