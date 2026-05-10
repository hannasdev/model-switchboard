import fs from "node:fs";
import path from "node:path";

function ensureFile(storePath) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  if (!fs.existsSync(storePath)) fs.writeFileSync(storePath, "{}\n", "utf8");
}

function readStore(storePath) {
  ensureFile(storePath);
  return JSON.parse(fs.readFileSync(storePath, "utf8"));
}

function writeStore(storePath, data) {
  ensureFile(storePath);
  fs.writeFileSync(storePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

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