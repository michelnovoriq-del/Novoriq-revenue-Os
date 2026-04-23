import { env } from "../config/env.js";
import { readJsonFile, writeJsonFile } from "./file-store.js";

const emptyState = { sessions: [] };

async function readState() {
  return readJsonFile(env.sessionStoreFile, emptyState);
}

async function writeState(state) {
  await writeJsonFile(env.sessionStoreFile, state);
}

export async function createSession(session) {
  const state = await readState();
  state.sessions.push(session);
  await writeState(state);
  return session;
}

export async function findSessionById(id) {
  const state = await readState();
  return state.sessions.find((session) => session.id === id) ?? null;
}

export async function deleteSession(id) {
  const state = await readState();
  state.sessions = state.sessions.filter((session) => session.id !== id);
  await writeState(state);
}

export async function deleteSessionsForUser(userId) {
  const state = await readState();
  state.sessions = state.sessions.filter((session) => session.userId !== userId);
  await writeState(state);
}
