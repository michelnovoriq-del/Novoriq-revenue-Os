import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

function toDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapSessionRecord(session) {
  if (!session) {
    return null;
  }

  return {
    id: session.id,
    userId: session.userId,
    fingerprintId: session.fingerprintId ?? null,
    ipAddress: session.ipAddress ?? null,
    country: session.country ?? null,
    city: session.city ?? null,
    userAgent: session.userAgent ?? null,
    createdAt: toDate(session.createdAt)
  };
}

function mapActivityLogRecord(activityLog) {
  if (!activityLog) {
    return null;
  }

  return {
    id: activityLog.id,
    userId: activityLog.userId,
    sessionId: activityLog.sessionId,
    action: activityLog.action,
    metadata: activityLog.metadata,
    createdAt: toDate(activityLog.createdAt)
  };
}

function mapEvidenceRecord(evidence) {
  if (!evidence) {
    return null;
  }

  return {
    id: evidence.id,
    userId: evidence.userId,
    sessionId: evidence.sessionId ?? null,
    chargeId: evidence.chargeId,
    disputeId: evidence.disputeId ?? null,
    disputeStatus: evidence.disputeStatus ?? "none",
    recoveredAmount:
      typeof evidence.recoveredAmount === "number" ? evidence.recoveredAmount : null,
    receiptIp: evidence.receiptIp,
    chargeTimestamp: toDate(evidence.chargeTimestamp),
    createdAt: toDate(evidence.createdAt),
    session: mapSessionRecord(evidence.session)
  };
}

function mapRecoveryLogRecord(recoveryLog) {
  if (!recoveryLog) {
    return null;
  }

  return {
    id: recoveryLog.id,
    userId: recoveryLog.userId,
    chargeId: recoveryLog.chargeId,
    disputeId: recoveryLog.disputeId,
    recoveredAmount: recoveryLog.recoveredAmount,
    platformFee: recoveryLog.platformFee,
    status: recoveryLog.status,
    billedAt: toDate(recoveryLog.billedAt),
    createdAt: toDate(recoveryLog.createdAt)
  };
}

function mapEvidenceBundle(record) {
  if (!record) {
    return null;
  }

  return {
    evidence: mapEvidenceRecord(record),
    session: mapSessionRecord(record.session ?? record.evidence?.session ?? null),
    activityLogs: Array.isArray(record.activityLogs)
      ? record.activityLogs.map(mapActivityLogRecord)
      : [],
    user: record.user
      ? {
          id: record.user.id,
          email: record.user.email,
          subscriptionTier: record.user.subscriptionTier ?? null,
          unpaidPerformanceBalance:
            typeof record.user.unpaidPerformanceBalance === "number"
              ? record.user.unpaidPerformanceBalance
              : 0,
          totalRecoveredRevenue:
            typeof record.user.totalRecoveredRevenue === "number"
              ? record.user.totalRecoveredRevenue
              : 0
        }
      : null
  };
}

export async function createEvidenceSession({
  id,
  userId,
  fingerprintId,
  ipAddress,
  country,
  city,
  userAgent
}) {
  const session = await prisma.session.create({
    data: {
      id,
      userId,
      fingerprintId,
      ipAddress,
      country,
      city,
      userAgent
    }
  });

  return mapSessionRecord(session);
}

export async function findEvidenceSessionById(sessionId) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId }
  });

  return mapSessionRecord(session);
}

export async function findLatestEvidenceSessionByUserId(userId) {
  const session = await prisma.session.findFirst({
    where: {
      userId,
      fingerprintId: {
        not: null
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return mapSessionRecord(session);
}

export async function createActivityLog({ userId, sessionId, action, metadata }) {
  const activityLog = await prisma.activityLog.create({
    data: {
      userId,
      sessionId,
      action,
      metadata: metadata ?? Prisma.JsonNull
    }
  });

  return mapActivityLogRecord(activityLog);
}

export async function listActivityLogsBySessionId(sessionId) {
  const activityLogs = await prisma.activityLog.findMany({
    where: { sessionId },
    orderBy: {
      createdAt: "asc"
    }
  });

  return activityLogs.map(mapActivityLogRecord);
}

export async function upsertEvidence({
  userId,
  sessionId,
  chargeId,
  disputeId,
  disputeStatus,
  recoveredAmount,
  receiptIp,
  chargeTimestamp
}) {
  const evidence = await prisma.evidence.upsert({
    where: { chargeId },
    update: {
      userId,
      sessionId: sessionId ?? undefined,
      disputeId: disputeId ?? undefined,
      disputeStatus: disputeStatus ?? undefined,
      recoveredAmount:
        typeof recoveredAmount === "number"
          ? recoveredAmount
          : recoveredAmount === null
            ? null
            : undefined,
      receiptIp: receiptIp ?? undefined,
      chargeTimestamp: toDate(chargeTimestamp) ?? undefined
    },
    create: {
      userId,
      sessionId: sessionId ?? null,
      chargeId,
      disputeId: disputeId ?? null,
      disputeStatus: disputeStatus ?? "none",
      recoveredAmount: typeof recoveredAmount === "number" ? recoveredAmount : null,
      receiptIp: receiptIp ?? "",
      chargeTimestamp: toDate(chargeTimestamp) ?? new Date()
    },
    include: {
      session: true
    }
  });

  return mapEvidenceRecord(evidence);
}

export async function findEvidenceByChargeId(chargeId) {
  const evidence = await prisma.evidence.findUnique({
    where: { chargeId },
    include: {
      session: true
    }
  });

  return mapEvidenceRecord(evidence);
}

export async function createRecoveryLog({
  userId,
  chargeId,
  disputeId,
  recoveredAmount,
  platformFee
}) {
  const recoveryLog = await prisma.recoveryLog.create({
    data: {
      userId,
      chargeId,
      disputeId,
      recoveredAmount,
      platformFee,
      status: "pending"
    }
  });

  return mapRecoveryLogRecord(recoveryLog);
}

export async function hasRecoveryLogForDispute(disputeId) {
  const recoveryLog = await prisma.recoveryLog.findFirst({
    where: { disputeId }
  });

  return Boolean(recoveryLog);
}

export async function markPendingRecoveryLogsBilledForUser(userId) {
  const billedAt = new Date();

  const pendingLogs = await prisma.recoveryLog.findMany({
    where: {
      userId,
      status: "pending"
    }
  });

  if (pendingLogs.length === 0) {
    return [];
  }

  await prisma.recoveryLog.updateMany({
    where: {
      userId,
      status: "pending"
    },
    data: {
      status: "billed",
      billedAt
    }
  });

  return pendingLogs.map((recoveryLog) =>
    mapRecoveryLogRecord({
      ...recoveryLog,
      status: "billed",
      billedAt
    })
  );
}

export async function markRecoveryLogsPaidForUser(userId) {
  await prisma.recoveryLog.updateMany({
    where: {
      userId,
      status: {
        in: ["pending", "billed"]
      }
    },
    data: {
      status: "paid"
    }
  });
}

export async function listRecoveryLogsByUserId(userId) {
  const recoveryLogs = await prisma.recoveryLog.findMany({
    where: { userId },
    orderBy: {
      createdAt: "desc"
    }
  });

  return recoveryLogs.map(mapRecoveryLogRecord);
}

export async function getDisputeEvidenceBundle(chargeId) {
  const evidence = await prisma.evidence.findUnique({
    where: { chargeId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          subscriptionTier: true,
          unpaidPerformanceBalance: true,
          totalRecoveredRevenue: true
        }
      },
      session: true
    }
  });

  if (!evidence) {
    return null;
  }

  const activityLogs = evidence.sessionId
    ? await prisma.activityLog.findMany({
        where: { sessionId: evidence.sessionId },
        orderBy: {
          createdAt: "asc"
        }
      })
    : [];

  return mapEvidenceBundle({
    ...evidence,
    activityLogs
  });
}

export async function getAdminOverviewMetrics() {
  const [totalUsers, activeUsers, userRevenueAggregate, recoveryFeeAggregate, recentDisputes] =
    await Promise.all([
      prisma.user.count({
        where: {
          role: "user"
        }
      }),
      prisma.user.count({
        where: {
          role: "user",
          hasAccess: true
        }
      }),
      prisma.user.aggregate({
        _sum: {
          totalRecoveredRevenue: true
        },
        where: {
          role: "user"
        }
      }),
      prisma.recoveryLog.aggregate({
        _sum: {
          platformFee: true
        }
      }),
      prisma.evidence.findMany({
        where: {
          disputeId: {
            not: null
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 10,
        include: {
          user: {
            select: {
              email: true
            }
          }
        }
      })
    ]);

  return {
    totalUsers,
    activeUsers,
    totalRecoveredRevenue: userRevenueAggregate._sum.totalRecoveredRevenue ?? 0,
    totalPlatformFees: recoveryFeeAggregate._sum.platformFee ?? 0,
    recentDisputes: recentDisputes.map((evidence) => ({
      userEmail: evidence.user.email,
      chargeId: evidence.chargeId,
      disputeId: evidence.disputeId,
      disputeStatus: evidence.disputeStatus,
      recoveredAmount: evidence.recoveredAmount,
      createdAt: toDate(evidence.createdAt)
    }))
  };
}

export async function listAdminUsers() {
  const users = await prisma.user.findMany({
    where: {
      role: "user"
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      email: true,
      subscriptionTier: true,
      unpaidPerformanceBalance: true,
      totalRecoveredRevenue: true,
      stripeRestrictedKey: true,
      createdAt: true
    }
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    subscriptionTier: user.subscriptionTier ?? null,
    unpaidPerformanceBalance: user.unpaidPerformanceBalance ?? 0,
    totalRecoveredRevenue: user.totalRecoveredRevenue ?? 0,
    stripeConnected: Boolean(user.stripeRestrictedKey),
    createdAt: toDate(user.createdAt)
  }));
}

export async function getUserMetrics(userId) {
  const [user, disputesWon, pendingDisputes] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        totalRecoveredRevenue: true,
        unpaidPerformanceBalance: true
      }
    }),
    prisma.evidence.count({
      where: {
        userId,
        disputeStatus: "won"
      }
    }),
    prisma.evidence.count({
      where: {
        userId,
        disputeStatus: {
          in: ["submitted", "warning_needs_response", "warning_under_review", "under_review"]
        }
      }
    })
  ]);

  if (!user) {
    return null;
  }

  return {
    recoveredRevenue: user.totalRecoveredRevenue ?? 0,
    disputesWon,
    pendingDisputes,
    currentBalance: user.unpaidPerformanceBalance ?? 0
  };
}
