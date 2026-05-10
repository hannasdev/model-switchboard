import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { handleClaudeHookInput } from "../src/poc/claude_hook_bridge.js";

function tempLogPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "claude-hook-test-")), "events.ndjson");
}

test("UserPromptSubmit routes Claude prompt and injects advisory context", () => {
  const logPath = tempLogPath();
  const output = handleClaudeHookInput(
    {
      session_id: "claude-session-1",
      transcript_path: "/tmp/claude-transcript.jsonl",
      cwd: process.cwd(),
      permission_mode: "default",
      hook_event_name: "UserPromptSubmit",
      prompt: "Implement the plan."
    },
    { logPath }
  );

  assert.equal(output.continue, true);
  assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(output.hookSpecificOutput.additionalContext, /Recommended: best coder/);
  assert.match(output.hookSpecificOutput.additionalContext, /advisory/);

  const [entry] = fs.readFileSync(logPath, "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(entry.event, "UserPromptSubmit");
  assert.equal(entry.route.mode, "implement");
  assert.equal(entry.route.selectedTarget.label, "best coder");
});

test("PreToolUse allows observed safe tools", () => {
  const output = handleClaudeHookInput(
    {
      session_id: "claude-session-1",
      hook_event_name: "PreToolUse",
      tool_name: "Read",
      tool_input: { file_path: "package.json" }
    },
    { logPath: tempLogPath() }
  );

  assert.equal(output.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(output.hookSpecificOutput.permissionDecision, "allow");
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /allowed it/);
});

test("PreToolUse denies destructive shell commands", () => {
  const output = handleClaudeHookInput(
    {
      session_id: "claude-session-1",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "rm -rf dist" }
    },
    { logPath: tempLogPath() }
  );

  assert.equal(output.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /blocks destructive/);
});
