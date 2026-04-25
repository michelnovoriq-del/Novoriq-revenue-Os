import { prisma } from "./prisma.js";
import { centsToDollars, normalizeStoredCents } from "./money.js";

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : email;
}

function toDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function omitUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function mapUserRecord(user) {
  if (!user) {
    return null;
  }

  const accessExpiration = toDate(user.accessExpiration);

  return {
    id: user.id,
    email: normalizeEmail(user.email),
    password_hash: user.passwordHash,
    role: user.role,
    hasPaid: user.hasPaid,
    hasAccess: user.hasAccess ?? user.hasPaid,
    subscriptionTier: user.subscriptionTier ?? null,
    performanceFeePercentage:
      typeof user.performanceFeePercentage === "number" ? user.performanceFeePercentage : null,
    unpaidPerformanceBalance: centsToDollars(user.unpaidPerformanceBalance),
    unpaidPerformanceBalanceCents:
      typeof user.unpaidPerformanceBalance === "number" ? user.unpaidPerformanceBalance : 0,
    totalRecoveredRevenue: centsToDollars(user.totalRecoveredRevenue),
    totalRecoveredRevenueCents:
      typeof user.totalRecoveredRevenue === "number" ? user.totalRecoveredRevenue : 0,
    accessExpiration,
    subscription_expires_at: accessExpiration,
    stripeRestrictedKey: user.stripeRestrictedKey ?? null,
    webhookSecret: user.webhookSecret ?? null,
    stripeConfigured: Boolean(user.stripeRestrictedKey),
    whopLastEventId: user.whopLastEventId ?? null,
    whopLastEventType: user.whopLastEventType ?? null,
    whopLastPlanId: user.whopLastPlanId ?? null,
    whopLastPaymentId: user.whopLastPaymentId ?? null,
    whopLastMembershipId: user.whopLastMembershipId ?? null,
    whopLastProcessedAt: toDate(user.whopLastProcessedAt),
    createdAt: toDate(user.createdAt)
  };
}

function toPrismaUserData(user) {
  const accessExpiration = toDate(user.accessExpiration ?? user.subscription_expires_at);
  const createdAt = toDate(user.createdAt);
  const whopLastProcessedAt = toDate(user.whopLastProcessedAt);

  return omitUndefined({
    email: normalizeEmail(user.email),
    passwordHash: user.password_hash ?? user.passwordHash,
    role: user.role,
    hasPaid: user.hasPaid ?? user.hasAccess ?? false,
    hasAccess: user.hasAccess ?? user.hasPaid ?? false,
    subscriptionTier: user.subscriptionTier ?? null,
    performanceFeePercentage:
      typeof user.performanceFeePercentage === "number" ? user.performanceFeePercentage : null,
    unpaidPerformanceBalance: normalizeStoredCents({
      cents: user.unpaidPerformanceBalanceCents,
      amount: user.unpaidPerformanceBalance
    }),
    totalRecoveredRevenue: normalizeStoredCents({
      cents: user.totalRecoveredRevenueCents,
      amount: user.totalRecoveredRevenue
    }),
    accessExpiration,
    stripeRestrictedKey: user.stripeRestrictedKey ?? null,
    webhookSecret: user.webhookSecret ?? null,
    whopLastEventId: user.whopLastEventId ?? null,
    whopLastEventType: user.whopLastEventType ?? null,
    whopLastPlanId: user.whopLastPlanId ?? null,
    whopLastPaymentId: user.whopLastPaymentId ?? null,
    whopLastMembershipId: user.whopLastMembershipId ?? null,
    whopLastProcessedAt,
    createdAt: createdAt ?? undefined
  });
}

export async function findUserByEmail(email) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) }
  });

  return mapUserRecord(user);
}

export async function findUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id }
  });

  return mapUserRecord(user);
}

export async function createUser(user) {
  const createdUser = await prisma.user.create({
    data: {
      id: user.id,
      ...toPrismaUserData(user)
    }
  });

  return mapUserRecord(createdUser);
}

export async function updateUser(id, updater) {
  const currentUser = await prisma.user.findUnique({
    where: { id }
  });

  if (!currentUser) {
    return null;
  }

  const nextUser = updater(mapUserRecord(currentUser));
  const updatedUser = await prisma.user.update({
    where: { id },
    data: toPrismaUserData(nextUser)
  });

  return mapUserRecord(updatedUser);
}
