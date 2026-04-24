import {
  getAdminOverviewMetrics,
  getUserMetrics,
  listAdminUsers,
  markPendingRecoveryLogsBilledForUser,
  markRecoveryLogsPaidForUser
} from "./evidence-store.js";
import { notifyBillingRun, notifyPaymentConfirmation } from "./dispute-notifier.js";
import { prisma } from "./prisma.js";
import { findUserById, updateUser } from "./user-store.js";

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

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

    await notifyBillingRun({
      userEmail: user.email,
      amountDue: user.unpaidPerformanceBalance ?? 0,
      recoveryCount: billedRecoveryLogs.length
    });

    billedUsers.push({
      userId: user.id,
      email: user.email,
      amountDue: user.unpaidPerformanceBalance ?? 0,
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

  await markRecoveryLogsPaidForUser(user.id);
  const updatedUser = await updateUser(user.id, (currentUser) => ({
    ...currentUser,
    unpaidPerformanceBalance: 0
  }));

  await notifyPaymentConfirmation({
    userEmail: updatedUser?.email ?? user.email
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
