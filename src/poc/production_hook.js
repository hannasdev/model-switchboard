import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { routePrompt } from "./router.js";

function defaultRunCommand(command, cwd) {
  try {
    const stdout = execSync(command, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8"
    });
    return { ok: true, command, stdout: stdout.trim(), stderr: "", exitCode: 0 };
  } catch (error) {
    return {
      ok: false,
      command,
      stdout: String(error?.stdout || "").trim(),
      stderr: String(error?.stderr || "").trim(),
      exitCode: Number.isInteger(error?.status) ? error.status : 1
    };
  }
}

function runToolAction({ toolAction, repoRoot, runCommand = defaultRunCommand }) {
  if (toolAction === "run_tests") {
    const cmdResult = runCommand("npm test", repoRoot);
    return {
      action: "run_tests",
      status: cmdResult.ok ? "ok" : "failed",
      command: cmdResult.command,
      exitCode: cmdResult.exitCode,
      stdoutPreview: (cmdResult.stdout || "").slice(0, 400),
      stderrPreview: (cmdResult.stderr || "").slice(0, 400)
    };
  }

  const targetPath = path.join(repoRoot, "package.json");
  const body = fs.readFileSync(targetPath, "utf8");
  return {
    action: "read_file",
    status: "ok",
    file: "package.json",
    bytes: Buffer.byteLength(body, "utf8"),
    preview: body.split(/\r?\n/).slice(0, 8).join("\n")
  };
}

export function executeProductionHookTurn({
  input,
  session = {},
  targets = [],
  repoRoot,
  toolAction = "read_file",
  runCommand
}) {
  const routeResult = routePrompt({
    input,
    session,
    targets,
    executionSupported: true
  });

  if (routeResult.status !== "ok") {
    return {
      status: "not_executed",
      reason: "route_not_ok",
      route: routeResult,
      nextSession: {
        ...session,
        turnCount: (session.turnCount || 0) + 1
      }
    };
  }

  const selectedLabel = routeResult.selectedTarget?.label || "";
  if (selectedLabel !== "best coder") {
    return {
      status: "executed_without_tools",
      reason: "target_not_tool_capable",
      route: routeResult,
      execution: {
        action: "none",
        selectedLabel
      },
      nextSession: {
        ...session,
        currentTargetId: routeResult.selectedTarget?.id || session.currentTargetId || null,
        turnCount: (session.turnCount || 0) + 1
      }
    };
  }

  const execution = runToolAction({ toolAction, repoRoot, runCommand });
  return {
    status: execution.status === "ok" ? "executed" : "failed",
    route: routeResult,
    execution,
    nextSession: {
      ...session,
      currentTargetId: routeResult.selectedTarget?.id || session.currentTargetId || null,
      turnCount: (session.turnCount || 0) + 1
    }
  };
}
