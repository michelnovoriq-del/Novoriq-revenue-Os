import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

function toDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapStripeEvent(event) {
  if (!event) {
    return null;
  }

  return {
    id: event.id,
    userId: event.userId,
    eventId: event.eventId,
    eventType: event.eventType,
    payload: event.payload,
    processingStatus: event.processingStatus,
    processingError: event.processingError ?? null,
    processingAttempts: event.processingAttempts ?? 0,
    processedAt: toDate(event.processedAt),
    createdAt: toDate(event.createdAt)
  };
}

export async function findStripeEventByEventId(eventId) {
  const event = await prisma.stripeEvent.findUnique({
    where: { eventId }
  });

  return mapStripeEvent(event);
}

export async function createStripeEvent({ userId, eventId, eventType, payload }) {
  try {
    const event = await prisma.stripeEvent.create({
      data: {
        userId,
        eventId,
        eventType,
        payload: payload ?? Prisma.JsonNull
      }
    });

    return mapStripeEvent(event);
  } catch (error) {
    if (error.code === "P2002") {
      return null;
    }

    throw error;
  }
}

export async function markStripeEventProcessingStarted(id) {
  const event = await prisma.stripeEvent.update({
    where: { id },
    data: {
      processingStatus: "processing",
      processingAttempts: {
        increment: 1
      },
      processingError: null
    }
  });

  return mapStripeEvent(event);
}

export async function markStripeEventProcessed(id) {
  const event = await prisma.stripeEvent.update({
    where: { id },
    data: {
      processingStatus: "processed",
      processingError: null,
      processedAt: new Date()
    }
  });

  return mapStripeEvent(event);
}

export async function markStripeEventFailed(id, errorMessage) {
  const event = await prisma.stripeEvent.update({
    where: { id },
    data: {
      processingStatus: "failed",
      processingError: typeof errorMessage === "string" ? errorMessage.slice(0, 2000) : "Unknown error"
    }
  });

  return mapStripeEvent(event);
}
