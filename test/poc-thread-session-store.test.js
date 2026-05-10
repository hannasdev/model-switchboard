import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadThreadSession, saveThreadSession, clearThreadSession } from "../src/switchboard/session_store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storePath = path.join(__dirname, "..", "src", "poc", "logs", "thread-sessions.test.json");

test("thread session store saves and loads continuity state", () => {
  if (fs.existsSync(storePath)) fs.unlinkSync(storePath);

  const saved = saveThreadSession({
    storePath,
    threadId: "thread-a",
    session: { mode: "plan", turnCount: 3, currentTargetId: "openai-coder" }
  });

  assert.equal(saved.turnCount, 3);
  const loaded = loadThreadSession({ storePath, threadId: "thread-a" });
  assert.equal(loaded.currentTargetId, "openai-coder");
  assert.equal(loaded.turnCount, 3);

  clearThreadSession({ storePath, threadId: "thread-a" });
  const cleared = loadThreadSession({ storePath, threadId: "thread-a" });
  assert.equal(cleared, null);
});
