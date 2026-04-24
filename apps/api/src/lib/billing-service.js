import {
  getAdminOverviewMetrics,
  getUserMetrics,
  listAdminUsers,
  markPendingRecoveryLogsBilledForUser,
  markRecoveryLogsPaidForUser
} from "./evidence-store.js";
import { notifyBillingRun, notifyPaymentConfirmation } from "./dispute-notifier.js";
import { prisma } from "./prisma.js";
import { findUserById } from "./user-store.js";
import { createHttpError } from "../utils/http.js";
import { logger } from "../utils/logger.js";

export async function runBillingCycle() {
  const users = await prisma.user.findMany({
    where: {
      role: "user",
      unpaidPerformanceBalance: {
        gt: 0
      }
    },
    select: {
      id: true,
      email: true,
      unpaidPerformanceBalance: true
    }
  });

  const billedUsers = [];

  for (const user of users) {
    const billedRecoveryLogs = await markPendingRecoveryLogsBilledForUser(user.id);

    if (billedRecoveryLogs.length === 0) {
      continue;
    }

    const amountDue = billedRecoveryLogs.reduce(
      (total, recoveryLog) => total + (recoveryLog.platformFee ?? 0),
      0
    );

    await notifyBillingRun({
      userEmail: user.email,
      amountDue,
      recoveryCount: billedRecoveryLogs.length
    });

    logger.info("Billing cycle processed user", {
      userId: user.id,
      recoveryCount: billedRecoveryLogs.length,
      amountDue
    });

    billedUsers.push({
      userId: user.id,
      email: user.email,
      amountDue,
      billedRecoveryCount: billedRecoveryLogs.length
    });
  }

  return {
    billedUsers,
    billedCount: billedUsers.length
  };
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
