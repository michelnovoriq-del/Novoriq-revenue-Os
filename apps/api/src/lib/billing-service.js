import {
  claimPendingRecoveryLogs,
  getAdminOverviewMetrics,
  getUserMetrics,
  listAdminUsers,
  markRecoveryLogsPaidForUser
} from "./evidence-store.js";
import { notifyBillingRun, notifyPaymentConfirmation } from "./dispute-notifier.js";
import { centsToDollars } from "./money.js";
import { prisma } from "./prisma.js";
import { findUserById } from "./user-store.js";
import { createHttpError } from "../utils/http.js";
import { logger } from "../utils/logger.js";

const globalBillingState = globalThis;

export async function runBillingCycle() {
  if (globalBillingState.__billingRunning) {
    logger.warn("Billing run skipped because another billing cycle is already active.");

    return {
      billedUsers: [],
      billedCount: 0,
      alreadyRunning: true
    };
  }

  globalBillingState.__billingRunning = true;

  try {
    const claimedRecoveryLogs = [];

    while (true) {
      const claimedBatch = await claimPendingRecoveryLogs();

      if (claimedBatch.length === 0) {
        break;
      }

      claimedRecoveryLogs.push(...claimedBatch);
    }

    if (claimedRecoveryLogs.length === 0) {
      return {
        billedUsers: [],
        billedCount: 0
      };
    }

    const userIds = [...new Set(claimedRecoveryLogs.map((recoveryLog) => recoveryLog.userId))];
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: userIds
        }
      },
      select: {
        id: true,
        email: true
      }
    });
    const usersById = new Map(users.map((user) => [user.id, user]));
    const billingSummariesByUserId = new Map();

    for (const recoveryLog of claimedRecoveryLogs) {
      const currentSummary = billingSummariesByUserId.get(recoveryLog.userId) ?? {
        userId: recoveryLog.userId,
        email: usersById.get(recoveryLog.userId)?.email ?? "",
        amountDueCents: 0,
        billedRecoveryCount: 0
      };

      currentSummary.amountDueCents += recoveryLog.platformFeeCents ?? 0;
      currentSummary.billedRecoveryCount += 1;

      billingSummariesByUserId.set(recoveryLog.userId, currentSummary);
    }

    const billedUsers = Array.from(billingSummariesByUserId.values()).map((summary) => ({
      ...summary,
      amountDue: centsToDollars(summary.amountDueCents)
    }));

    for (const billedUser of billedUsers) {
      await notifyBillingRun({
        userEmail: billedUser.email,
        amountDue: billedUser.amountDue,
        amountDueCents: billedUser.amountDueCents,
        recoveryCount: billedUser.billedRecoveryCount
      });

      logger.info("Billing cycle processed user", {
        userId: billedUser.userId,
        recoveryCount: billedUser.billedRecoveryCount,
        amountDue: billedUser.amountDue,
        amountDueCents: billedUser.amountDueCents
      });
    }

    return {
      billedUsers,
      billedCount: billedUsers.length
    };
  } finally {
    globalBillingState.__billingRunning = false;
  }
}

export async function markUserBalancePaid(userId) {
  const user = await findUserById(userId);

  if (!user) {
    throw createHttpError(404, "User not found");
  }

  const updatedUser = await markRecoveryLogsPaidForUser(user.id);

  await notifyPaymentConfirmation({
    userEmail: updatedUser?.email ?? user.email
  });

  logger.info("Marked user balance paid", {
    userId: user.id
  });

  return updatedUser;
}

export async function getAdminOverview() {
  return getAdminOverviewMetrics();
}

export async function getAdminUsers() {
  return listAdminUsers();
}

export async function getClientMetrics(userId) {
  const metrics = await getUserMetrics(userId);

  if (!metrics) {
    throw createHttpError(404, "User not found");
  }

  return metrics;
}
