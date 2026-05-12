import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { handleClaudeHookInput } from "../src/switchboard/claude-hook-bridge.js";
import { saveRouteContext } from "../src/switchboard/route-context.js";

function tempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-hook-test-"));
  return {
    logPath: path.join(dir, "events.ndjson"),
    routeContextPath: path.join(dir, "route-context.json")
  };
}

function readLog(logPath) {
  return fs.readFileSync(logPath, "utf8").trim().split("\n").map(JSON.parse);
}

test("UserPromptSubmit routes Claude prompt and injects advisory context", () => {
  const { logPath, routeContextPath } = tempPaths();
  const output = handleClaudeHookInput(
    {
      session_id: "claude-session-1",
      transcript_path: "/tmp/claude-transcript.jsonl",
      cwd: process.cwd(),
      permission_mode: "default",
      hook_event_name: "UserPromptSubmit",
      prompt: "Implement the plan."
    },
    { logPath, routeContextPath }
  );

  assert.equal(output.continue, true);
  assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(output.hookSpecificOutput.additionalContext, /Recommended: best coder/);
  assert.match(output.hookSpecificOutput.additionalContext, /advisory/);

  const [entry] = readLog(logPath);
  assert.equal(entry.event, "UserPromptSubmit");
  assert.equal(entry.correlation.status, "missing");
  assert.equal(entry.route.mode, "implement");
  assert.equal(entry.route.selectedTarget.label, "best coder");
});

test("UserPromptSubmit correlates hook event with Switchboard route context", () => {
  const { logPath, routeContextPath } = tempPaths();
  saveRouteContext({
    storePath: routeContextPath,
    context: {
      threadId: "thread-1",
      claudeSessionId: "claude-session-1",
      turnCount: 1,
      routeLabel: "best coder",
      targetId: "anthropic-coder",
      model: "sonnet",
      effort: "high",
      mode: "debug",
      executionMode: "live",
      wrapperContext: {
        kind: "switchboard_context",
        text: "Switchboard: best coder - tests - higher effort"
      }
    }
  });

  const output = handleClaudeHookInput(
    {
      session_id: "claude-session-1",
      transcript_path: "/tmp/claude-transcript.jsonl",
      cwd: process.cwd(),
      permission_mode: "default",
      hook_event_name: "UserPromptSubmit",
      prompt: "What probe phrase was provided earlier in this session?"
    },
    { logPath, routeContextPath }
  );

  assert.equal(output.continue, true);
  assert.match(output.hookSpecificOutput.additionalContext, /Switchboard wrapper route/);
  assert.match(output.hookSpecificOutput.additionalContext, /Target label: best coder/);
  assert.match(output.hookSpecificOutput.additionalContext, /sonnet\/high/);

  const [entry] = readLog(logPath);
  assert.equal(entry.correlation.status, "matched");
  assert.equal(entry.correlation.context.latest.threadId, "thread-1");
  assert.equal(entry.correlation.context.latest.routeLabel, "best coder");
});

test("PreToolUse allows observed safe tools", () => {
  const { logPath, routeContextPath } = tempPaths();
  saveRouteContext({
    storePath: routeContextPath,
    context: {
      threadId: "thread-2",
      claudeSessionId: "claude-session-1",
      turnCount: 1,
      routeLabel: "best coder",
      targetId: "anthropic-coder",
      model: "sonnet",
      effort: "high",
      mode: "debug",
      executionMode: "live",
      wrapperContext: { kind: "switchboard_context", text: "Switchboard: best coder" }
    }
  });
  const output = handleClaudeHookInput(
    {
      session_id: "claude-session-1",
      hook_event_name: "PreToolUse",
      tool_name: "Read",
      tool_input: { file_path: "package.json" }
    },
    { logPath, routeContextPath }
  );

  assert.equal(output.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(output.hookSpecificOutput.permissionDecision, "allow");
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /allowed it/);

  const [entry] = readLog(logPath);
  assert.equal(entry.correlation.status, "matched");
  assert.equal(entry.correlation.context.latest.targetId, "anthropic-coder");
});

test("PreToolUse denies destructive shell commands", () => {
  const { logPath, routeContextPath } = tempPaths();
  const output = handleClaudeHookInput(
    {
      session_id: "claude-session-1",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "rm -rf dist" }
    },
    { logPath, routeContextPath }
  );

  assert.equal(output.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /blocks destructive/);

  const [entry] = readLog(logPath);
  assert.equal(entry.correlation.status, "missing");
});

test("PreToolUse denies safe tools without matched Switchboard route context", () => {
  const { logPath, routeContextPath } = tempPaths();
  const output = handleClaudeHookInput(
    {
      session_id: "claude-session-1",
      hook_event_name: "PreToolUse",
      tool_name: "Read",
      tool_input: { file_path: "package.json" }
    },
    { logPath, routeContextPath }
  );

  assert.equal(output.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /matched wrapper route context/);

  const [entry] = readLog(logPath);
  assert.equal(entry.correlation.status, "missing");
  assert.equal(entry.output.hookSpecificOutput.permissionDecision, "deny");
});
