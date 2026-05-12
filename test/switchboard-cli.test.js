import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runSwitchboardCli } from "../src/switchboard/cli.js";

function tempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "switchboard-cli-test-"));
  return {
    storePath: path.join(dir, "sessions.json"),
    logPath: path.join(dir, "turns.ndjson"),
    routeContextPath: path.join(dir, "route-context.json"),
    hookLogPath: path.join(dir, "hook-events.ndjson")
  };
}

function memoryIo() {
  let stdout = "";
  let stderr = "";
  return {
    stdout: {
      write(chunk) {
        stdout += chunk;
      }
    },
    stderr: {
      write(chunk) {
        stderr += chunk;
      }
    },
    get stdoutText() {
      return stdout;
    },
    get stderrText() {
      return stderr;
    }
  };
}

test("switchboard dry-run routes a prompt through the MVP command shape", () => {
  const paths = tempPaths();
  const io = memoryIo();
  const exitCode = runSwitchboardCli(
    [
      "--dry-run",
      "--thread-id",
      "mvp-thread",
      "--store-path",
      paths.storePath,
      "--log-path",
      paths.logPath,
      "--route-context-path",
      paths.routeContextPath,
      "Implement the plan."
    ],
    io
  );

  assert.equal(exitCode, 0);
  assert.match(io.stdoutText, /Switchboard: best coder/);
  assert.match(io.stdoutText, /Claude session:/);
  assert.equal(io.stderrText, "");

  const routeContext = JSON.parse(fs.readFileSync(paths.routeContextPath, "utf8"));
  const [sessionId] = Object.keys(routeContext);
  assert.equal(routeContext[sessionId].latest.threadId, "mvp-thread");
  assert.equal(routeContext[sessionId].latest.routeLabel, "best coder");
});

test("switchboard explain summarizes latest route context and hook events", () => {
  const paths = tempPaths();
  const turnIo = memoryIo();
  runSwitchboardCli(
    [
      "--dry-run",
      "--thread-id",
      "explain-thread",
      "--store-path",
      paths.storePath,
      "--log-path",
      paths.logPath,
      "--route-context-path",
      paths.routeContextPath,
      "That is a wrong assumption. Compare alternatives again."
    ],
    turnIo
  );
  const routeContext = JSON.parse(fs.readFileSync(paths.routeContextPath, "utf8"));
  const [sessionId] = Object.keys(routeContext);
  fs.writeFileSync(
    paths.hookLogPath,
    `${JSON.stringify({
      ts: "2026-05-10T00:00:00.000Z",
      source: "claude_code_hook",
      event: "PreToolUse",
      sessionId,
      correlation: { status: "matched" },
      toolName: "Read",
      output: {
        hookSpecificOutput: {
          permissionDecision: "allow"
        }
      }
    })}\n`,
    "utf8"
  );

  const explainIo = memoryIo();
  const exitCode = runSwitchboardCli(
    [
      "explain",
      "--thread-id",
      "explain-thread",
      "--log-path",
      paths.logPath,
      "--route-context-path",
      paths.routeContextPath,
      "--hook-log-path",
      paths.hookLogPath
    ],
    explainIo
  );

  assert.equal(exitCode, 0);
  assert.match(explainIo.stdoutText, /Router route: best coder/);
  assert.match(explainIo.stdoutText, /Router status: ok/);
  assert.match(explainIo.stdoutText, /Decision Reasoning:/);
  assert.match(explainIo.stdoutText, /Escalation: .*user_correction/);
  assert.match(explainIo.stdoutText, /Route context: matched/);
  assert.match(explainIo.stdoutText, /Hook events: 1/);
  assert.match(explainIo.stdoutText, /PreToolUse correlation=matched allow/);
});

test("switchboard advise returns an advisory decision for an openai surface", () => {
  const io = memoryIo();
  const exitCode = runSwitchboardCli(
    ["advise", "--surface", "openai-codex", "Implement the plan."],
    io
  );

  assert.equal(exitCode, 0);
  assert.match(io.stdoutText, /Switchboard advisory \(openai-codex\): best coder/);
  assert.match(io.stdoutText, /Surface: openai-codex/);
  assert.match(io.stdoutText, /Recommended target: best coder \(openai-coder\)/);
  assert.match(io.stdoutText, /Required: repo_context, file_read, file_edit/);
  assert.equal(io.stderrText, "");
});

test("switchboard advise json exposes the routing decision contract", () => {
  const io = memoryIo();
  const exitCode = runSwitchboardCli(
    ["advise", "--surface", "openai-codex", "--json", "Implement the plan."],
    io
  );

  assert.equal(exitCode, 0);
  const result = JSON.parse(io.stdoutText);
  assert.equal(result.surface, "openai-codex");
  assert.equal(result.status, "ok");
  assert.equal(result.routeDecision.targetId, "openai-coder");
  assert.equal(result.routingDecision.schemaVersion, "0.1.0-experimental");
  assert.equal(result.routingDecision.selectedTargetId, "openai-coder");
  assert.equal(result.routingDecision.status, "ok");
});

test("switchboard advise json stays contract-consistent across multiple surfaces", () => {
  const cases = [
    { surface: "openai-codex", expectedTargetId: "openai-coder" },
    { surface: "google-gemini", expectedTargetId: "gemini-coder" },
    { surface: "claude", expectedTargetId: "anthropic-coder" }
  ];

  for (const testCase of cases) {
    const io = memoryIo();
    const exitCode = runSwitchboardCli(
      ["advise", "--surface", testCase.surface, "--json", "Implement the plan."],
      io
    );

    assert.equal(exitCode, 0);
    const result = JSON.parse(io.stdoutText);
    assert.equal(result.surface, testCase.surface);
    assert.equal(result.status, "ok");
    assert.equal(result.routeDecision.targetId, testCase.expectedTargetId);
    assert.equal(result.routingDecision.schemaVersion, "0.1.0-experimental");
    assert.equal(result.routingDecision.selectedTargetId, testCase.expectedTargetId);
    assert.equal(result.routingDecision.status, "ok");
    assert.deepEqual(result.routeDecision.requiredCapabilities, ["repo_context", "file_read", "file_edit"]);
  }
});

test("switchboard advise accepts common vendor aliases", () => {
  const io = memoryIo();
  const exitCode = runSwitchboardCli(
    ["advise", "--surface", "gemini", "--json", "Implement the plan."],
    io
  );

  assert.equal(exitCode, 0);
  const result = JSON.parse(io.stdoutText);
  assert.equal(result.surface, "google-gemini");
  assert.equal(result.routeDecision.targetId, "gemini-coder");
  assert.equal(result.routingDecision.selectedTargetId, "gemini-coder");
});

test("switchboard advise rejects an unknown advisory surface", () => {
  const io = memoryIo();
  const exitCode = runSwitchboardCli(
    ["advise", "--surface", "unknown-surface", "Implement the plan."],
    io
  );

  assert.equal(exitCode, 1);
  assert.match(io.stderrText, /unknown surface 'unknown-surface'/);
  assert.equal(io.stdoutText, "");
});

test("switchboard requires a prompt for routed turns", () => {
  const io = memoryIo();
  const exitCode = runSwitchboardCli(["--dry-run"], io);

  assert.equal(exitCode, 1);
  assert.match(io.stderrText, /requires a prompt/);
});

test("switchboard reports pre-launch failures without executing Claude", () => {
  const paths = tempPaths();
  fs.mkdirSync(paths.routeContextPath, { recursive: true });
  const io = memoryIo();
  const exitCode = runSwitchboardCli(
    [
      "--thread-id",
      "failure-thread",
      "--store-path",
      paths.storePath,
      "--log-path",
      paths.logPath,
      "--route-context-path",
      paths.routeContextPath,
      "Implement the plan."
    ],
    io
  );

  assert.equal(exitCode, 1);
  assert.match(io.stderrText, /failed before launching Claude/);
  assert.equal(io.stdoutText, "");
});

test("switchboard stronger override escalates a low-risk prompt", () => {
  const paths = tempPaths();
  const io = memoryIo();
  const exitCode = runSwitchboardCli(
    [
      "--dry-run",
      "--stronger",
      "--thread-id",
      "stronger-thread",
      "--store-path",
      paths.storePath,
      "--log-path",
      paths.logPath,
      "--route-context-path",
      paths.routeContextPath,
      "Thanks"
    ],
    io
  );

  assert.equal(exitCode, 0);
  assert.match(io.stdoutText, /Switchboard: best coder/);
  assert.match(io.stdoutText, /Override: stronger/);
  assert.match(io.stdoutText, /Claude target: sonnet\/high/);
});

test("switchboard stay override keeps an eligible current target", () => {
  const paths = tempPaths();
  const firstIo = memoryIo();
  runSwitchboardCli(
    [
      "--dry-run",
      "--thread-id",
      "stay-thread",
      "--store-path",
      paths.storePath,
      "--log-path",
      paths.logPath,
      "--route-context-path",
      paths.routeContextPath,
      "Implement the plan."
    ],
    firstIo
  );

  const secondIo = memoryIo();
  const exitCode = runSwitchboardCli(
    [
      "--dry-run",
      "--stay",
      "--thread-id",
      "stay-thread",
      "--store-path",
      paths.storePath,
      "--log-path",
      paths.logPath,
      "--route-context-path",
      paths.routeContextPath,
      "Thanks"
    ],
    secondIo
  );

  assert.equal(exitCode, 0);
  assert.match(secondIo.stdoutText, /Switchboard: best coder/);
  assert.match(secondIo.stdoutText, /Override: stay/);
  assert.match(secondIo.stdoutText, /Claude target: sonnet\/high/);
});

test("switchboard cheaper override downshifts when capability-safe", () => {
  const paths = tempPaths();
  const firstIo = memoryIo();
  runSwitchboardCli(
    [
      "--dry-run",
      "--thread-id",
      "cheaper-thread",
      "--store-path",
      paths.storePath,
      "--log-path",
      paths.logPath,
      "--route-context-path",
      paths.routeContextPath,
      "Implement the plan."
    ],
    firstIo
  );

  const secondIo = memoryIo();
  const exitCode = runSwitchboardCli(
    [
      "--dry-run",
      "--cheaper",
      "--thread-id",
      "cheaper-thread",
      "--store-path",
      paths.storePath,
      "--log-path",
      paths.logPath,
      "--route-context-path",
      paths.routeContextPath,
      "Thanks"
    ],
    secondIo
  );

  assert.equal(exitCode, 0);
  assert.match(secondIo.stdoutText, /Switchboard: quick/);
  assert.match(secondIo.stdoutText, /Override: cheaper/);
  assert.match(secondIo.stdoutText, /Claude target: haiku\/low/);
});

test("switchboard rejects a prompt when --interactive is set", () => {
  const io = memoryIo();
  const exitCode = runSwitchboardCli(
    ["--dry-run", "--interactive", "Implement the plan."],
    io
  );

  assert.equal(exitCode, 1);
  assert.match(io.stderrText, /does not accept a prompt argument/);
  assert.equal(io.stdoutText, "");
});

test("switchboard interactive dry-run works without a prompt", () => {
  const paths = tempPaths();
  const io = memoryIo();
  const exitCode = runSwitchboardCli(
    [
      "--dry-run",
      "--interactive",
      "--thread-id",
      "interactive-thread",
      "--store-path",
      paths.storePath,
      "--log-path",
      paths.logPath,
      "--route-context-path",
      paths.routeContextPath
    ],
    io
  );

  assert.equal(exitCode, 0);
  assert.match(io.stdoutText, /Switchboard: quick/);
  assert.match(io.stdoutText, /Status: planned/);
  assert.equal(io.stderrText, "");
});

test("switchboard interactive stronger override escalates target selection", () => {
  const paths = tempPaths();
  const io = memoryIo();
  const exitCode = runSwitchboardCli(
    [
      "--dry-run",
      "--interactive",
      "--stronger",
      "--thread-id",
      "interactive-stronger-thread",
      "--store-path",
      paths.storePath,
      "--log-path",
      paths.logPath,
      "--route-context-path",
      paths.routeContextPath
    ],
    io
  );

  assert.equal(exitCode, 0);
  assert.match(io.stdoutText, /Switchboard: best coder/);
  assert.match(io.stdoutText, /Override: stronger/);
  assert.match(io.stdoutText, /Claude target: sonnet\/high/);
  assert.equal(io.stderrText, "");
});

test("switchboard interactive cheaper override downshifts target selection", () => {
  const paths = tempPaths();
  const io = memoryIo();
  const exitCode = runSwitchboardCli(
    [
      "--dry-run",
      "--interactive",
      "--cheaper",
      "--thread-id",
      "interactive-cheaper-thread",
      "--store-path",
      paths.storePath,
      "--log-path",
      paths.logPath,
      "--route-context-path",
      paths.routeContextPath
    ],
    io
  );

  assert.equal(exitCode, 0);
  assert.match(io.stdoutText, /Switchboard: quick/);
  assert.match(io.stdoutText, /Override: cheaper/);
  assert.match(io.stdoutText, /Claude target: haiku\/low/);
  assert.equal(io.stderrText, "");
});

test("switchboard interactive stay override keeps the current eligible target", () => {
  const paths = tempPaths();
  const firstIo = memoryIo();
  runSwitchboardCli(
    [
      "--dry-run",
      "--interactive",
      "--thread-id",
      "interactive-stay-thread",
      "--store-path",
      paths.storePath,
      "--log-path",
      paths.logPath,
      "--route-context-path",
      paths.routeContextPath
    ],
    firstIo
  );

  const secondIo = memoryIo();
  const exitCode = runSwitchboardCli(
    [
      "--dry-run",
      "--interactive",
      "--stay",
      "--thread-id",
      "interactive-stay-thread",
      "--store-path",
      paths.storePath,
      "--log-path",
      paths.logPath,
      "--route-context-path",
      paths.routeContextPath
    ],
    secondIo
  );

  assert.equal(exitCode, 0);
  assert.match(secondIo.stdoutText, /Switchboard: quick/);
  assert.match(secondIo.stdoutText, /Override: stay/);
  assert.match(secondIo.stdoutText, /Claude target: haiku\/low/);
  assert.equal(secondIo.stderrText, "");
});

test("switchboard interactive continuity probe command reports verified checks", () => {
  const paths = tempPaths();
  const io = memoryIo();
  const exitCode = runSwitchboardCli(
    [
      "probe",
      "continuity-interactive",
      "--thread-id",
      "probe-interactive-thread",
      "--claude-bin",
      "true",
      "--inter-turn-delay-ms",
      "0",
      "--store-path",
      paths.storePath,
      "--log-path",
      paths.logPath,
      "--route-context-path",
      paths.routeContextPath
    ],
    io
  );

  assert.equal(exitCode, 0);
  assert.match(io.stdoutText, /Probe: continuity-interactive/);
  assert.match(io.stdoutText, /Status: verified/);
  assert.match(io.stdoutText, /allExecuted/);
  assert.match(io.stdoutText, /sameClaudeSessionAcrossThreeTurns/);
  assert.match(io.stdoutText, /secondTurnUsesResume/);
  assert.match(io.stdoutText, /thirdTurnUsesResume/);
  assert.equal(io.stderrText, "");
});

test("switchboard interactive continuity probe only enforces hook checks when hook log is explicit", () => {
  const paths = tempPaths();

  const defaultIo = memoryIo();
  const defaultExitCode = runSwitchboardCli(
    [
      "probe",
      "continuity-interactive",
      "--thread-id",
      "probe-interactive-hook-default-thread",
      "--claude-bin",
      "true",
      "--inter-turn-delay-ms",
      "0",
      "--store-path",
      paths.storePath,
      "--log-path",
      paths.logPath,
      "--route-context-path",
      paths.routeContextPath
    ],
    defaultIo
  );
  assert.equal(defaultExitCode, 0);
  assert.doesNotMatch(defaultIo.stdoutText, /hookEventsPresent/);

  fs.writeFileSync(paths.hookLogPath, "", "utf8");
  const explicitIo = memoryIo();
  const explicitExitCode = runSwitchboardCli(
    [
      "probe",
      "continuity-interactive",
      "--thread-id",
      "probe-interactive-hook-explicit-thread",
      "--claude-bin",
      "true",
      "--inter-turn-delay-ms",
      "0",
      "--hook-log-path",
      paths.hookLogPath,
      "--store-path",
      paths.storePath,
      "--log-path",
      paths.logPath,
      "--route-context-path",
      paths.routeContextPath
    ],
    explicitIo
  );
  assert.equal(explicitExitCode, 1);
  assert.match(explicitIo.stdoutText, /hookEventsPresent/);
  assert.match(explicitIo.stdoutText, /hookEventsCorrelated/);
});
