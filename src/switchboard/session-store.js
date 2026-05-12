import { readStore, writeStore } from "./fs-utils.js";

export function loadThreadSession({ storePath, threadId }) {
  const store = readStore(storePath);
  return store[threadId] || null;
}

export function saveThreadSession({ storePath, threadId, session }) {
  const store = readStore(storePath);
  store[threadId] = {
    ...session,
    updatedAt: new Date().toISOString()
  };
  writeStore(storePath, store);
  return store[threadId];
}

export function clearThreadSession({ storePath, threadId }) {
  const store = readStore(storePath);
  delete store[threadId];
  writeStore(storePath, store);
}