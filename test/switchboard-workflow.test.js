import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  executeSwitchboardContinuityProbe,
  executeSwitchboardInteractiveContinuityProbe,
  executeSwitchboardTurn,
  explainLatestSwitchboardTurn,
  planSwitchboardContinuityProbe,
  planSwitchboardTurn,
  replayRoutingDecision
} from "../src/switchboard/workflow.js";

function tempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "switchboard-workflow-test-"));
  return {
    storePath: path.join(dir, "sessions.json"),
    logPath: path.join(dir, "turns.ndjson"),
    routeContextPath: path.join(dir, "route-context.json")
  };
}

function readLog(logPath) {
  return fs.readFileSync(logPath, "utf8").trim().split("\n").map(JSON.parse);
}

test("Switchboard turn plans Claude launch and records separable evidence", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();
  const result = planSwitchboardTurn({
    input: "Implement the plan.",
    threadId: "thread-1",
    sessionId: "claude-session-1",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath
  });

  assert.equal(result.status, "planned");
  assert.equal(result.routeDecision.label, "best coder");
  assert.equal(result.routeDecision.taskType, "multi_file_refactor");
  assert.equal(result.routeDecision.continuityCost, "low");
  assert.equal(result.routeDecision.modeResolution.resolvedMode, "implement");
  assert.equal(result.routeDecision.policyInputs.hardConstraints.privacy, "off");
  assert.deepEqual(result.routeDecision.escalationPolicy?.reasons, []);
  assert.equal(result.routingDecision.schemaVersion, "0.1.0-experimental");
  assert.equal(result.routingDecision.status, "ok");
  assert.equal(result.routingDecision.selectedTargetId, "anthropic-coder");
  assert.deepEqual(result.routingDecision.hardConstraintResults.eligibleTargetIds, ["anthropic-coder"]);
  assert.equal(result.selectedClaude.model, "sonnet");
  assert.equal(result.selectedClaude.effort, "high");
  assert.equal(result.selectedClaude.sessionId, "claude-session-1");
  assert.match(result.wrapperContext.text, /^Switchboard: best coder/);
  assert.equal(result.nextSession.currentTargetId, "anthropic-coder");
  assert.equal(result.nextSession.turnCount, 1);

  const [entry] = readLog(logPath);
  assert.equal(entry.source, "switchboard_wrapper");
  assert.equal(entry.userPrompt, "Implement the plan.");
  assert.equal(entry.router.routingDecision.status, "ok");
  assert.equal(entry.router.routingDecision.schemaVersion, "0.1.0-experimental");
  assert.equal(entry.router.routeDecision.label, "best coder");
  assert.equal(entry.router.sessionState.sessionId, "claude-session-1");
  assert.equal(entry.router.contextPackage.routeLabel, "best coder");
  assert.equal(entry.claude.selectedClaude.model, "sonnet");
  assert.equal(entry.wrapperContext.kind, "switchboard_context");
  assert.equal(entry.routeDecision.label, "best coder");
  assert.deepEqual(entry.routeDecision.escalationPolicy?.reasons, []);
  assert.equal(entry.selectedClaude.effort, "high");
  assert.equal(entry.session.claudeSessionId, "claude-session-1");

  const routeContext = JSON.parse(fs.readFileSync(routeContextPath, "utf8"));
  assert.equal(routeContext["claude-session-1"].latest.threadId, "thread-1");
  assert.equal(routeContext["claude-session-1"].latest.routeLabel, "best coder");
  assert.equal(routeContext["claude-session-1"].latest.model, "sonnet");
  assert.equal(routeContext["claude-session-1"].latest.sessionState.sessionId, "claude-session-1");
  assert.equal(routeContext["claude-session-1"].latest.routingDecision.status, "ok");
  assert.equal(routeContext["claude-session-1"].latest.routingDecision.schemaVersion, "0.1.0-experimental");
  assert.equal(routeContext["claude-session-1"].latest.contextPackage.routeLabel, "best coder");
  assert.equal(routeContext["claude-session-1"].latest.claudeExecution.model, "sonnet");
});

test("Switchboard contract decision remaps blocked entries to contract field names", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();
  const result = planSwitchboardTurn({
    input: "Implement the plan.",
    threadId: "thread-contract-blocked",
    sessionId: "claude-session-contract-blocked",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath,
    targets: [
      {
        id: "anthropic-coder",
        label: "best coder",
        provider: "anthropic",
        client: "claude-code",
        capabilities: ["repo_context", "file_read", "file_edit"],
        availability: "available",
        privacy_tier: "standard"
      },
      {
        id: "anthropic-quick",
        label: "quick",
        provider: "anthropic",
        client: "claude-code",
        capabilities: ["chat"],
        availability: "unavailable",
        privacy_tier: "standard"
      }
    ],
    persist: false
  });

  assert.equal(result.routingDecision.status, "ok");
  assert.deepEqual(result.routingDecision.hardConstraintResults.eligibleTargetIds, ["anthropic-coder"]);
  assert.deepEqual(result.routingDecision.hardConstraintResults.blocked, [
    {
      targetId: "anthropic-quick",
      missingCapabilities: ["repo_context", "file_read", "file_edit"],
      constraintReasons: []
    }
  ]);
});

test("Switchboard explain returns contract-backed router and Claude evidence", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();
  planSwitchboardTurn({
    input: "Implement the plan.",
    threadId: "thread-explain-contract",
    sessionId: "claude-session-explain-contract",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath
  });

  const explanation = explainLatestSwitchboardTurn({
    logPath,
    routeContextPath,
    threadId: "thread-explain-contract"
  });

  assert.equal(explanation.status, "found");
  assert.equal(explanation.routerEvidence.routingDecision.status, "ok");
  assert.equal(explanation.routerEvidence.routeDecision.label, "best coder");
  assert.equal(explanation.claudeEvidence.selectedClaude.model, "sonnet");
  assert.equal(explanation.routeContext.status, "matched");
  assert.equal(explanation.routeContext.sessionState.sessionId, "claude-session-explain-contract");
  assert.equal(explanation.routeContext.contextPackage.routeLabel, "best coder");
});

test("Switchboard logs escalation policy details for escalated turns", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();
  const result = planSwitchboardTurn({
    input: "That is a wrong assumption. Compare alternatives again.",
    threadId: "thread-escalation",
    sessionId: "claude-session-escalation",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath
  });

  assert.equal(result.status, "planned");
  assert.equal(result.routeDecision.label, "best coder");
  assert.equal(result.routeDecision.escalationPolicy?.applied, true);
  assert.equal(result.routeDecision.escalationPolicy?.reasons.includes("user_correction"), true);

  const [entry] = readLog(logPath);
  assert.equal(entry.routeDecision.escalationPolicy?.applied, true);
  assert.equal(entry.routeDecision.escalationPolicy?.reasons.includes("user_correction"), true);
});

test("Switchboard continuity probe preserves Claude session while route changes", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();
  const result = planSwitchboardContinuityProbe({
    threadId: "thread-2",
    sessionId: "claude-session-2",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath
  });

  assert.equal(result.status, "verified");
  assert.deepEqual(result.verified, {
    sameClaudeSession: true,
    routeCanChange: true,
    turnCountAdvanced: true
  });
  assert.equal(result.turns[0].routeDecision.label, "best coder");
  assert.equal(result.turns[1].routeDecision.label, "quick");
  assert.equal(result.turns[0].selectedClaude.sessionId, "claude-session-2");
  assert.equal(result.turns[1].selectedClaude.sessionId, "claude-session-2");
  assert.equal(result.turns[0].claudePlan.resume, false);
  assert.equal(result.turns[1].claudePlan.resume, true);
  assert.equal(result.turns[1].selectedClaude.commandPreview.includes("--resume"), true);
  assert.equal(result.turns[1].previousSession.currentTargetId, "anthropic-coder");
  assert.equal(result.turns[1].nextSession.turnCount, 2);

  const entries = readLog(logPath);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].routeDecision.label, "best coder");
  assert.equal(entries[1].routeDecision.label, "quick");
  assert.equal(entries[0].session.claudeSessionId, entries[1].session.claudeSessionId);
});

test("Live Switchboard continuity probe captures execution evidence", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();
  const executions = [];
  const result = executeSwitchboardContinuityProbe({
    threadId: "thread-3",
    sessionId: "claude-session-3",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath,
    noTools: true,
    commandRunner(plan) {
      executions.push(plan);
      return {
        status: 0,
        signal: null,
        stdout:
          executions.length === 1
            ? "{\"result\":\"OK\"}"
            : "{\"result\":\"switchboard-continuity-2718\"}",
        stderr: "",
        error: null
      };
    }
  });

  assert.equal(result.status, "verified");
  assert.deepEqual(result.verified, {
    bothExecuted: true,
    sameClaudeSession: true,
    routeCanChange: true,
    turnCountAdvanced: true,
    secondTurnHasFirstTurnContext: true
  });
  assert.equal(result.turns[0].status, "executed");
  assert.equal(result.turns[1].status, "executed");
  assert.equal(result.turns[0].execution.status, "executed");
  assert.match(result.turns[1].execution.stdoutPreview, /switchboard-continuity-2718/);
  assert.equal(result.turns[0].routeDecision.label, "best coder");
  assert.equal(result.turns[1].routeDecision.label, "balanced");
  assert.equal(executions[0].args.includes("--tools="), true);

  const entries = readLog(logPath);
  assert.equal(entries[0].executionMode, "live");
  assert.equal(entries[0].execution.status, "executed");
  assert.equal(entries[1].execution.stdoutPreview, "{\"result\":\"switchboard-continuity-2718\"}");
});

test("Switchboard live failure keeps normalized turn fields internally consistent", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();

  executeSwitchboardTurn({
    input: "Fail this run to test attempted turn indexing.",
    threadId: "thread-turn-consistency",
    sessionId: "claude-session-turn-consistency",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath,
    commandRunner() {
      return {
        status: 1,
        signal: null,
        stdout: "",
        stderr: "simulated failure",
        error: { message: "simulated failure" }
      };
    }
  });

  const [entry] = readLog(logPath);
  assert.equal(entry.turnIndex, 1);
  assert.equal(entry.sessionState.turnCount, entry.turnIndex);
  assert.equal(entry.contextPackage.turnIndex, entry.turnIndex);
});

test("Consecutive failed live attempts keep unique turn index and decision ID", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();

  function failingRunner() {
    return {
      status: 1,
      signal: null,
      stdout: "",
      stderr: "simulated failure",
      error: { message: "simulated failure" }
    };
  }

  const first = executeSwitchboardTurn({
    input: "first failing attempt",
    threadId: "thread-fail-attempt-counter",
    sessionId: "session-fail-attempt-counter",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath,
    commandRunner: failingRunner
  });

  const second = executeSwitchboardTurn({
    input: "second failing attempt",
    threadId: "thread-fail-attempt-counter",
    sessionId: "session-fail-attempt-counter",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath,
    commandRunner: failingRunner
  });

  assert.equal(first.evidence.turnIndex, 1);
  assert.equal(second.evidence.turnIndex, 2);
  assert.notEqual(first.evidence.attribution.decisionId, second.evidence.attribution.decisionId);

  // Persisted success turn count stays unchanged for failed executions.
  assert.equal(first.nextSession.turnCount, 0);
  assert.equal(second.nextSession.turnCount, 0);

  const routeContext = JSON.parse(fs.readFileSync(routeContextPath, "utf8"));
  const turns = routeContext["session-fail-attempt-counter"].turns;
  assert.equal(turns.length, 2);
  assert.equal(turns[0].turnCount, 1);
  assert.equal(turns[1].turnCount, 2);
});

test("Replay uses recorded attribution policyVersion when decision contract lacks policyVersion", () => {
  const replayed = replayRoutingDecision({
    evidence: {
      ts: "2026-05-11T00:00:00.000Z",
      sessionId: "session-policy-version",
      threadId: "thread-policy-version",
      turnIndex: 3,
      routingDecision: {
        selectedTargetId: "anthropic-coder"
      },
      attribution: {
        decisionId: "decision-policy-version",
        policyVersion: "0.1.0-experimental",
        decisionConfidence: 0.9,
        switchingReason: null
      }
    },
    policyVersion: "0.1.0-experimental"
  });

  assert.equal(replayed.originalPolicyVersion, "0.1.0-experimental");
  assert.equal(replayed.matches, true);
});

test("Replay supports legacy nested router evidence shape", () => {
  const replayed = replayRoutingDecision({
    evidence: {
      ts: "2026-05-11T00:00:00.000Z",
      sessionId: "session-router-nested",
      threadId: "thread-router-nested",
      turnIndex: 2,
      router: {
        routingDecision: {
          selectedTargetId: "anthropic-coder"
        },
        sessionState: {
          turnCount: 2
        }
      },
      attribution: {
        decisionId: "decision-router-nested",
        policyVersion: "0.1.0-experimental",
        decisionConfidence: 0.88,
        switchingReason: "no_switch"
      }
    },
    policyVersion: "0.1.0-experimental"
  });

  assert.equal(replayed.status, "replayed");
  assert.equal(replayed.originalSelectedTargetId, "anthropic-coder");
  assert.equal(replayed.evidence.sessionState.turnCount, 2);
  assert.equal(replayed.matches, true);
});

test("Switchboard interactive turns preserve Claude continuity without prompt args", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();
  const firstTurn = planSwitchboardTurn({
    input: "",
    interactive: true,
    threadId: "thread-4",
    sessionId: "claude-session-4",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath
  });
  const secondTurn = planSwitchboardTurn({
    input: "",
    interactive: true,
    threadId: "thread-4",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath
  });

  assert.equal(firstTurn.status, "planned");
  assert.equal(secondTurn.status, "planned");
  assert.equal(firstTurn.claudePlan.interactive, true);
  assert.equal(secondTurn.claudePlan.interactive, true);
  assert.equal(firstTurn.claudePlan.args.includes("--print"), false);
  assert.equal(secondTurn.claudePlan.args.includes("--print"), false);
  assert.equal(firstTurn.claudePlan.args.includes("--session-id"), true);
  assert.equal(secondTurn.claudePlan.args.includes("--resume"), true);
  assert.equal(firstTurn.selectedClaude.sessionId, "claude-session-4");
  assert.equal(secondTurn.selectedClaude.sessionId, "claude-session-4");
  assert.equal(firstTurn.nextSession.turnCount, 1);
  assert.equal(secondTurn.nextSession.turnCount, 2);
  assert.equal(secondTurn.claudePlan.args.at(-1), "claude-session-4");
});

test("Live interactive continuity probe verifies resume and session continuity", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();
  const executions = [];
  const result = executeSwitchboardInteractiveContinuityProbe({
    threadId: "thread-5",
    sessionId: "claude-session-5",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath,
    commandRunner(plan) {
      executions.push(plan);
      return {
        status: 0,
        signal: null,
        stdout: "interactive-ok",
        stderr: "",
        error: null
      };
    }
  });

  assert.equal(result.status, "verified");
  assert.deepEqual(result.verified, {
    allExecuted: true,
    sameClaudeSessionAcrossThreeTurns: true,
    secondTurnUsesResume: true,
    thirdTurnUsesResume: true,
    interactiveArgsOmitPrompt: true,
    turnCountAdvanced: true
  });
  assert.equal(result.turns.length, 3);
  assert.equal(result.turns[0].claudePlan.interactive, true);
  assert.equal(result.turns[1].claudePlan.resume, true);
  assert.equal(result.turns[2].claudePlan.resume, true);
  assert.equal(executions[0].args.includes("--print"), false);
  assert.equal(executions[1].args.includes("--print"), false);
  assert.equal(executions[2].args.includes("--print"), false);
  assert.equal(executions[1].args.includes("--resume"), true);
  assert.equal(executions[2].args.includes("--resume"), true);
});

test("Live interactive continuity probe with explicit hook log requires present correlated events", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();
  const hookLogPath = path.join(path.dirname(logPath), "hook-events.ndjson");
  const result = executeSwitchboardInteractiveContinuityProbe({
    threadId: "thread-5-hooks-missing",
    sessionId: "claude-session-5-hooks-missing",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath,
    hookLogPath,
    commandRunner() {
      return {
        status: 0,
        signal: null,
        stdout: "interactive-ok",
        stderr: "",
        error: null
      };
    }
  });

  assert.equal(result.status, "needs_review");
  assert.equal(result.verified.hookEventsPresent, false);
  assert.equal(result.verified.hookEventsCorrelated, false);
});

test("Live interactive continuity probe ignores stale hook events from older runs", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();
  const hookLogPath = path.join(path.dirname(logPath), "hook-events.ndjson");
  fs.writeFileSync(
    hookLogPath,
    `${JSON.stringify({
      ts: "2000-01-01T00:00:00.000Z",
      sessionId: "claude-session-5-hooks-stale",
      correlation: { status: "matched" }
    })}\n`,
    "utf8"
  );

  const result = executeSwitchboardInteractiveContinuityProbe({
    threadId: "thread-5-hooks-stale",
    sessionId: "claude-session-5-hooks-stale",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath,
    hookLogPath,
    commandRunner() {
      return {
        status: 0,
        signal: null,
        stdout: "interactive-ok",
        stderr: "",
        error: null
      };
    }
  });

  assert.equal(result.status, "needs_review");
  assert.equal(result.verified.hookEventsPresent, false);
  assert.equal(result.verified.hookEventsCorrelated, false);
});

test("Live interactive continuity probe passes hook checks when fresh matched events are present", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();
  const hookLogPath = path.join(path.dirname(logPath), "hook-events.ndjson");

  const result = executeSwitchboardInteractiveContinuityProbe({
    threadId: "thread-5-hooks-present",
    sessionId: "claude-session-5-hooks-present",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath,
    hookLogPath,
    commandRunner(plan) {
      fs.appendFileSync(
        hookLogPath,
        `${JSON.stringify({
          ts: new Date().toISOString(),
          sessionId: plan.sessionId,
          correlation: { status: "matched" }
        })}\n`,
        "utf8"
      );
      return {
        status: 0,
        signal: null,
        stdout: "interactive-ok",
        stderr: "",
        error: null
      };
    }
  });

  assert.equal(result.status, "verified");
  assert.equal(result.verified.hookEventsPresent, true);
  assert.equal(result.verified.hookEventsCorrelated, true);
});

test("Interactive live turn does NOT recover from non-stale-resume failures", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();
  planSwitchboardTurn({
    input: "",
    interactive: true,
    threadId: "thread-7",
    sessionId: "claude-session-7",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath
  });

  const executions = [];
  const result = executeSwitchboardTurn({
    input: "",
    interactive: true,
    threadId: "thread-7",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath,
    commandRunner(plan) {
      executions.push([...plan.args]);
      return {
        status: 1,
        signal: null,
        stdout: "",
        stderr: "Error: authentication failed\n",
        error: null
      };
    }
  });

  assert.equal(result.status, "failed");
  assert.equal(result.recovery.recoveredFromResumeRetry, false);
  assert.equal(executions.length, 1);
  assert.equal(executions[0].includes("--resume"), true);
});

test("Interactive live turn recovers from stale resume by retrying with session-id", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();
  planSwitchboardTurn({
    input: "",
    interactive: true,
    threadId: "thread-6",
    sessionId: "claude-session-6",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath
  });

  const executions = [];
  const result = executeSwitchboardTurn({
    input: "",
    interactive: true,
    threadId: "thread-6",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath,
    commandRunner(plan) {
      executions.push([...plan.args]);
      if (plan.args.includes("--resume")) {
        return {
          status: 1,
          signal: null,
          stdout: "",
          stderr: "No conversation found with session ID: claude-session-6\n",
          error: null
        };
      }
      return {
        status: 0,
        signal: null,
        stdout: "interactive-recovered",
        stderr: "",
        error: null
      };
    }
  });

  assert.equal(result.status, "executed");
  assert.equal(result.recovery.recoveredFromResumeRetry, true);
  assert.equal(result.claudePlan.resume, false);
  assert.equal(result.claudePlan.args.includes("--session-id"), true);
  assert.equal(result.nextSession.turnCount, 2);
  assert.equal(executions.length, 2);
  assert.equal(executions[0].includes("--resume"), true);
  assert.equal(executions[1].includes("--session-id"), true);
});

test("Interactive default runner captures stderr while passing stdin/stdout to terminal", () => {
  // Directly verify the stdio shape used by the default runner.
  // With stdio: ["inherit", "inherit", "pipe"] and encoding: "utf8",
  // spawnSync returns a string for stderr and null for stdout (inherited).
  // This proves the stale-resume detection can actually fire in real runs.
  const result = spawnSync(
    "sh",
    ["-c", "echo 'No conversation found with session ID: test-id' >&2; exit 1"],
    {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["inherit", "inherit", "pipe"]
    }
  );

  assert.equal(result.status, 1);
  assert.equal(typeof result.stderr, "string");
  assert.match(result.stderr, /No conversation found with session ID/);
  // stdout is null because it was inherited, not piped
  assert.equal(result.stdout, null);
});
