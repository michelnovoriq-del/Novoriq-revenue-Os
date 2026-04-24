import { env } from "../config/env.js";

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
    console.error("[NOTIFIER] Failed to send email notification.", {
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
  platformFee
}) {
  await sendNotification({
    to: buildRecipients(userEmail),
    subject: `Recovered revenue for ${chargeId}`,
    text: `Dispute ${disputeId} was won for user ${userId}. Recovered amount: ${recoveredAmount}. Platform fee: ${platformFee}.`
  });
}

export async function notifyBillingRun({ userEmail, amountDue, recoveryCount }) {
  await sendNotification({
    to: buildRecipients(userEmail),
    subject: "Performance billing notice",
    text: `A billing run marked ${recoveryCount} recovery items for invoicing. Amount due: ${amountDue}.`
  });
}

export async function notifyPaymentConfirmation({ userEmail }) {
  await sendNotification({
    to: buildRecipients(userEmail),
    subject: "Payment confirmation",
    text: "Your outstanding performance balance has been marked as paid."
  });
}
