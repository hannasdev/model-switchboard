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
      "Implement the plan."
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
  assert.match(explainIo.stdoutText, /Route: best coder/);
  assert.match(explainIo.stdoutText, /Route context: matched/);
  assert.match(explainIo.stdoutText, /Hook events: 1/);
  assert.match(explainIo.stdoutText, /PreToolUse correlation=matched allow/);
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
