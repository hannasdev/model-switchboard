import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import {
  saveAttribution,
  loadSessionAttributions,
  loadAttributionByDecisionId,
  updateAttributionOutcome,
  queryAttributionsByErrorSignal,
  getSessionAttributionStats
} from "../src/switchboard/attribution_store.js";
import { planSwitchboardTurn } from "../src/switchboard/workflow.js";

function tempAttributionPath() {
  return path.join(os.tmpdir(), `switchboard-attribution-test-${process.pid}-${randomUUID()}`);
}

test("attribution store saves and loads attributions by sessionId", () => {
  const storePath = tempAttributionPath();

  const record1 = saveAttribution({
    storePath,
    sessionId: "session-1",
    attribution: {
      decisionId: "decision-1",
      decisionConfidence: 0.95,
      switchingReason: null,
      escalationApplied: false,
      policyVersion: "0.1.0-experimental"
    }
  });

  assert.equal(record1.decisionId, "decision-1");
  assert.ok(record1.savedAt);

  const loaded = loadSessionAttributions({ storePath, sessionId: "session-1" });
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].decisionId, "decision-1");
});

test("attribution store appends multiple records to same session", () => {
  const storePath = tempAttributionPath();

  saveAttribution({
    storePath,
    sessionId: "session-2",
    attribution: {
      decisionId: "decision-1",
      decisionConfidence: 0.9,
      switchingReason: null,
      escalationApplied: false,
      policyVersion: "0.1.0-experimental"
    }
  });

  saveAttribution({
    storePath,
    sessionId: "session-2",
    attribution: {
      decisionId: "decision-2",
      decisionConfidence: 0.8,
      switchingReason: "continuity_cost",
      escalationApplied: false,
      policyVersion: "0.1.0-experimental"
    }
  });

  const loaded = loadSessionAttributions({ storePath, sessionId: "session-2" });
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].decisionId, "decision-1");
  assert.equal(loaded[1].decisionId, "decision-2");
});

test("attribution store loads by decision ID", () => {
  const storePath = tempAttributionPath();

  saveAttribution({
    storePath,
    sessionId: "session-3",
    attribution: {
      decisionId: "unique-decision-xyz",
      decisionConfidence: 0.85,
      switchingReason: "capability_gap",
      escalationApplied: true,
      policyVersion: "0.1.0-experimental"
    }
  });

  const record = loadAttributionByDecisionId({
    storePath,
    sessionId: "session-3",
    decisionId: "unique-decision-xyz"
  });

  assert.ok(record);
  assert.equal(record.decisionId, "unique-decision-xyz");
  assert.equal(record.switchingReason, "capability_gap");
});

test("attribution store updates outcome for a decision", () => {
  const storePath = tempAttributionPath();

  saveAttribution({
    storePath,
    sessionId: "session-4",
    attribution: {
      decisionId: "decision-outcome",
      decisionConfidence: 0.9,
      switchingReason: null,
      escalationApplied: false,
      policyVersion: "0.1.0-experimental"
    }
  });

  const updated = updateAttributionOutcome({
    storePath,
    sessionId: "session-4",
    decisionId: "decision-outcome",
    outcome: {
      executionStatus: "executed",
      exitCode: 0,
      errorSignal: null,
      durationMs: 1500
    }
  });

  assert.ok(updated.outcome);
  assert.equal(updated.outcome.errorSignal, null);
  assert.equal(updated.outcome.durationMs, 1500);
});

test("attribution store queries by error signal", () => {
  const storePath = tempAttributionPath();

  saveAttribution({
    storePath,
    sessionId: "session-5",
    attribution: {
      decisionId: "d1",
      decisionConfidence: 0.9,
      switchingReason: null,
      escalationApplied: false,
      policyVersion: "0.1.0-experimental",
      outcome: { errorSignal: null }
    }
  });

  saveAttribution({
    storePath,
    sessionId: "session-5",
    attribution: {
      decisionId: "d2",
      decisionConfidence: 0.7,
      switchingReason: null,
      escalationApplied: false,
      policyVersion: "0.1.0-experimental",
      outcome: { errorSignal: "tool_failure" }
    }
  });

  const allRecords = queryAttributionsByErrorSignal({
    storePath,
    sessionId: "session-5"
  });
  assert.equal(allRecords.length, 2);

  const failures = queryAttributionsByErrorSignal({
    storePath,
    sessionId: "session-5",
    errorSignal: "tool_failure"
  });
  assert.equal(failures.length, 1);
});

test("attribution store computes session statistics", () => {
  const storePath = tempAttributionPath();

  for (let i = 0; i < 10; i++) {
    saveAttribution({
      storePath,
      sessionId: "session-6",
      attribution: {
        decisionId: `decision-${i}`,
        decisionConfidence: 0.8 + (i * 0.01),
        switchingReason: null,
        escalationApplied: false,
        policyVersion: "0.1.0-experimental",
        outcome: i < 8 ? { errorSignal: null } : { errorSignal: "tool_failure" }
      }
    });
  }

  const stats = getSessionAttributionStats({
    storePath,
    sessionId: "session-6"
  });

  assert.equal(stats.totalDecisions, 10);
  assert.equal(stats.successCount, 8);
  assert.equal(stats.failureCount, 2);
  assert.equal(stats.successRate, 0.8);
  assert.ok(stats.avgConfidence > 0.8);
  assert.equal(stats.failuresBySignal["tool_failure"], 2);
  assert.equal(stats.failuresBySignal["success"], 8);
});

test("Switchboard turn includes normalized attribution fields in log", () => {
  // Use a test helper like the other switchboard tests do
  const testId = `attribution-norm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const basePath = path.join(os.tmpdir(), testId);
  
  // Clean up any previous test artifacts
  if (fs.existsSync(basePath)) {
    fs.rmSync(basePath, { recursive: true, force: true });
  }
  
  const storePath = path.join(basePath, "store");
  const logPath = path.join(basePath, "switchboard.log");
  const routeContextPath = path.join(basePath, "route-context.json");

  const result = planSwitchboardTurn({
    input: "Test the attribution normalization.",
    threadId: "thread-attribution-test",
    sessionId: "session-attribution-test",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath,
    persist: false
  });

  // Read the log entry
  const logContent = fs.readFileSync(logPath, "utf8");
  const entry = JSON.parse(logContent.trim());

  // Verify normalized fields are present
  assert.equal(entry.schemaVersion, "0.1.0-experimental");
  assert.ok(entry.sessionId);
  assert.ok(entry.turnIndex !== undefined);
  assert.ok(entry.outcome);
  assert.ok(entry.outcome.executionStatus);
  assert.ok(entry.outcome.errorSignal !== undefined);
  assert.ok(entry.attribution);
  assert.ok(entry.attribution.decisionId);
  assert.ok(entry.attribution.decisionConfidence !== undefined);
  assert.ok(entry.attribution.switchingReason !== undefined);
  assert.ok(entry.attribution.policyVersion);

  // Verify backward compatibility: legacy fields still present
  assert.ok(entry.executionMode);
  assert.ok(entry.routeDecision);
  assert.ok(entry.selectedClaude);
});
