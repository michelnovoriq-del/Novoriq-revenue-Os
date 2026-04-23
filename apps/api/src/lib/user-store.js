import { env } from "../config/env.js";
import { readJsonFile, writeJsonFile } from "./file-store.js";

const emptyState = { users: [] };

async function readState() {
  return readJsonFile(env.userStoreFile, emptyState);
}

async function writeState(state) {
  await writeJsonFile(env.userStoreFile, state);
}

export async function findUserByEmail(email) {
  const state = await readState();
  return state.users.find((user) => user.email === email) ?? null;
}

export async function findUserById(id) {
  const state = await readState();
  return state.users.find((user) => user.id === id) ?? null;
}

export async function createUser(user) {
  const state = await readState();
  state.users.push(user);
  await writeState(state);
  return user;
}

export async function updateUser(id, updater) {
  const state = await readState();
  const index = state.users.findIndex((user) => user.id === id);

  if (index === -1) {
    return null;
  }

  const nextUser = updater(state.users[index]);
  state.users[index] = nextUser;
  await writeState(state);
  return nextUser;
}
