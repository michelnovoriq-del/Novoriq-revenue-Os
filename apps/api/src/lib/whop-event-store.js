import { env } from "../config/env.js";
import { readJsonFile, writeJsonFile } from "./file-store.js";

const emptyState = { processedEvents: [] };
const MAX_STORED_EVENTS = 5000;

async function readState() {
  return readJsonFile(env.whopEventStoreFile, emptyState);
}

async function writeState(state) {
  await writeJsonFile(env.whopEventStoreFile, state);
}

export async function findProcessedWhopEvent(eventId) {
  const state = await readState();

  return state.processedEvents.find((event) => event.eventId === eventId) ?? null;
}

export async function recordProcessedWhopEvent(event) {
  const state = await readState();
  const existingIndex = state.processedEvents.findIndex(
    (entry) => entry.eventId === event.eventId
  );

  if (existingIndex === -1) {
    state.processedEvents.push(event);
  } else {
    state.processedEvents[existingIndex] = {
      ...state.processedEvents[existingIndex],
      ...event
    };
  }

  if (state.processedEvents.length > MAX_STORED_EVENTS) {
    state.processedEvents = state.processedEvents.slice(-MAX_STORED_EVENTS);
  }

  await writeState(state);

  return event;
}
