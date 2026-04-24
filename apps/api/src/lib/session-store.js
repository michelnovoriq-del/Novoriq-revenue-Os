import { prisma } from "./prisma.js";

function toDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapSession(session) {
  if (!session) {
    return null;
  }

  return {
    id: session.id,
    userId: session.userId,
    tokenHash: session.tokenHash ?? null,
    expiresAt: toDate(session.expiresAt),
    fingerprintId: session.fingerprintId ?? null,
    ipAddress: session.ipAddress ?? null,
    country: session.country ?? null,
    city: session.city ?? null,
    userAgent: session.userAgent ?? null,
    createdAt: toDate(session.createdAt)
  };
}

export async function createSession(session) {
  const createdSession = await prisma.session.create({
    data: {
      id: session.id,
      userId: session.userId,
      tokenHash: session.tokenHash ?? null,
      expiresAt: toDate(session.expiresAt) ?? undefined,
      fingerprintId: session.fingerprintId ?? null,
      ipAddress: session.ipAddress ?? null,
      country: session.country ?? null,
      city: session.city ?? null,
      userAgent: session.userAgent ?? null,
      createdAt: toDate(session.createdAt) ?? undefined
    }
  });

  return mapSession(createdSession);
}

export async function findSessionById(id) {
  const session = await prisma.session.findUnique({
    where: { id }
  });

  return mapSession(session);
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

  return mapSession(session);
}

export async function deleteSession(id) {
  await prisma.session.deleteMany({
    where: { id }
  });
}

export async function deleteSessionsForUser(userId) {
  await prisma.session.deleteMany({
    where: { userId }
  });
}
