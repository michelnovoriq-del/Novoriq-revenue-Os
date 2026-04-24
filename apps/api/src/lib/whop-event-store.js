import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

function toDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapWhopEvent(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    userId: record.userId ?? null,
    eventId: record.eventId,
    eventType: record.eventType,
    status: record.status,
    email: record.email ?? null,
    planId: record.planId ?? null,
    reason: record.reason ?? null,
    payload: record.payload ?? null,
    processedAt: toDate(record.processedAt),
    createdAt: toDate(record.createdAt)
  };
}

export async function findProcessedWhopEvent(eventId) {
  const event = await prisma.whopEvent.findUnique({
    where: { eventId }
  });

  return mapWhopEvent(event);
}

export async function createWhopEvent(event) {
  try {
    const createdEvent = await prisma.whopEvent.create({
      data: {
        userId: event.userId ?? null,
        eventId: event.eventId,
        eventType: event.type,
        status: event.status,
        email: event.email ?? null,
        planId: event.planId ?? null,
        reason: event.reason ?? null,
        payload: event.payload ?? Prisma.JsonNull,
        processedAt: toDate(event.processedAt) ?? new Date()
      }
    });

    return mapWhopEvent(createdEvent);
  } catch (error) {
    if (error?.code === "P2002") {
      return null;
    }

    throw error;
  }
}

export async function updateWhopEventStatus(eventId, event) {
  const updatedEvent = await prisma.whopEvent.update({
    where: { eventId },
    data: {
      userId: event.userId ?? undefined,
      status: event.status,
      email: event.email ?? undefined,
      planId: event.planId ?? undefined,
      reason: event.reason ?? undefined,
      payload: event.payload ?? undefined,
      processedAt: toDate(event.processedAt) ?? new Date()
    }
  });

  return mapWhopEvent(updatedEvent);
}

export async function recordProcessedWhopEvent(event) {
  const createdEvent = await createWhopEvent(event);

  if (createdEvent) {
    return createdEvent;
  }

  return updateWhopEventStatus(event.eventId, event);
}
