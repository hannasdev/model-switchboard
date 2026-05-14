#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routePrompt } from "../src/router/router.js";
import { OPENAI_TARGETS_PATH } from "../src/switchboard/paths.js";
import { getProfileModelMap, getTargetProfileMap } from "../src/adapters/model-mappings.js";

const TARGET_TO_PROFILE = getTargetProfileMap("openai-codex");
const PROFILE_TO_MODEL = getProfileModelMap("openai-codex");
const DEFAULT_TIMEOUT_MS = 120000;

function readJson(filePath) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- probe reads the known targets path or explicit test fixture path.
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getArg(args, flag) {
  const idx = args.lastIndexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function runHelp(codexBin, args, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const result = spawnSync(codexBin, args, {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    timeout: timeoutMs
  });
  return {
    command: [codexBin, ...args].join(" "),
    status: result.status,
    signal: result.signal,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error ? result.error.message : null,
    ok: result.status === 0
  };
}

function hasOption(helpText, option) {
  return new RegExp(`(^|\\n)\\s*(?:-[^\\n,]+,\\s*)?${option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|[<\\[])`).test(helpText);
}

function hasCommand(helpText, command) {
  return new RegExp(`(^|\\n)\\s*${command}\\b`).test(helpText);
}

function routeTurnPlan({ input, session, targets }) {
  const route = routePrompt({
    input,
    session,
    targets,
    executionSupported: false
  });
  const targetId = route.selectedTarget?.id || null;
  const profile = targetId ? TARGET_TO_PROFILE[targetId] || null : null;
  const model = profile ? PROFILE_TO_MODEL[profile] || null : null;
  return {
    input,
    route: {
      status: route.status,
      mode: route.mode,
      selectedTargetId: targetId,
      targetClass: route.selectedTarget?.target_class || null,
      shouldSwitch: route.shouldSwitch,
      explanation: route.explanation
    },
    codex: {
      profile,
      model,
      execArgs: model ? ["exec", "--model", model, input] : null,
      resumeArgs: model ? ["exec", "resume", "--last", "--model", model, input] : null
    }
  };
}

function runCodexCommand(codexBin, args, { cwd = process.cwd(), timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const result = spawnSync(codexBin, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    timeout: timeoutMs
  });
  return {
    command: [codexBin, ...args].join(" "),
    args,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error ? result.error.message : null,
    ok: result.status === 0
  };
}

function parseJsonLines(text) {
  const events = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // Codex may print warnings before JSON events; keep raw output in evidence.
    }
  }
  return events;
}

function isUuid(value) {
  if (typeof value !== "string" || value.length !== 36) return false;
  const parts = value.split("-");
  if (parts.length !== 5) return false;
  const lengths = [8, 4, 4, 4, 12];
  return parts.every((part, index) => part.length === lengths[index] && [...part].every((char) => /[0-9a-f]/i.test(char)));
}

function collectSessionIds(value, ids = new Set()) {
  if (!value || typeof value !== "object") return ids;
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string" && /session/i.test(key) && isUuid(child)) {
      ids.add(child);
    } else if (child && typeof child === "object") {
      collectSessionIds(child, ids);
    }
  }
  return ids;
}

function extractSessionIds(text, events) {
  const ids = collectSessionIds({ events });
  for (const token of text.split(/[^0-9a-f-]+/i)) {
    if (isUuid(token)) {
      ids.add(token);
    }
  }
  return [...ids];
}

function readIfExists(filePath) {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- probe reads its own temp output files.
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

function tailText(text, maxLength = 1200) {
  if (!text) return "";
  return text.length > maxLength ? text.slice(text.length - maxLength) : text;
}

function summarizeLiveTurn({ label, plan, commandResult, outputPath }) {
  const events = parseJsonLines(commandResult.stdout);
  const text = `${commandResult.stdout}\n${commandResult.stderr}`;
  const sessionIds = extractSessionIds(text, events);
  const finalMessage = readIfExists(outputPath);
  return {
    label,
    selectedTargetId: plan.route.selectedTargetId,
    selectedProfile: plan.codex.profile,
    selectedModel: plan.codex.model,
    command: commandResult.command,
    status: commandResult.status,
    signal: commandResult.signal,
    error: commandResult.error,
    ok: commandResult.ok,
    stdoutTail: tailText(commandResult.stdout),
    stderrTail: tailText(commandResult.stderr),
    outputPath,
    finalMessageBytes: Buffer.byteLength(finalMessage, "utf8"),
    jsonEventCount: events.length,
    sessionIds
  };
}

function runLiveResumeProbe({ codexBin, first, second, cwd = process.cwd(), timeoutMs = DEFAULT_TIMEOUT_MS }) {
  if (!first.codex.model || !second.codex.model) {
    return {
      status: "blocked",
      reason: "The router did not resolve Codex models for both live turns.",
      turns: []
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-cli-feasibility-"));
  const firstOutputPath = path.join(tempDir, "turn-1-final-message.txt");
  const secondOutputPath = path.join(tempDir, "turn-2-final-message.txt");

  const firstResult = runCodexCommand(
    codexBin,
    [
      "exec",
      "--model",
      first.codex.model,
      "--sandbox",
      "read-only",
      "--json",
      "--output-last-message",
      firstOutputPath,
      "--cd",
      cwd,
      first.input
    ],
    { cwd, timeoutMs }
  );
  const firstTurn = summarizeLiveTurn({
    label: "first",
    plan: first,
    commandResult: firstResult,
    outputPath: firstOutputPath
  });

  if (!firstResult.ok) {
    return {
      status: "blocked",
      reason: "The first live Codex CLI turn failed.",
      turns: [firstTurn]
    };
  }

  const secondResult = runCodexCommand(
    codexBin,
    [
      "exec",
      "resume",
      "--last",
      "--model",
      second.codex.model,
      "-c",
      'sandbox_mode="read-only"',
      "--json",
      "--output-last-message",
      secondOutputPath,
      second.input
    ],
    { cwd, timeoutMs }
  );
  const secondTurn = summarizeLiveTurn({
    label: "second",
    plan: second,
    commandResult: secondResult,
    outputPath: secondOutputPath
  });

  if (!secondResult.ok) {
    return {
      status: "blocked",
      reason: "The resumed live Codex CLI turn failed.",
      turns: [firstTurn, secondTurn]
    };
  }

  const sharedSessionIds = firstTurn.sessionIds.filter((id) => secondTurn.sessionIds.includes(id));
  const modelChanged = first.codex.model !== second.codex.model;
  const continuityEvidence = sharedSessionIds.length > 0 ? "shared_session_id" : "resume_last_success_without_session_id";

  return {
    status: modelChanged && sharedSessionIds.length > 0 ? "verified" : "partial",
    reason:
      sharedSessionIds.length > 0
        ? "The live resumed turn completed with a different route-selected model and shared session evidence."
        : "The live resumed turn completed with a different route-selected model, but session continuity was not visible as a shared session id.",
    turns: [firstTurn, secondTurn],
    modelChanged,
    continuityEvidence,
    sharedSessionIds
  };
}

export function runCodexCliFeasibilityProbe({
  codexBin = "codex",
  targets = readJson(OPENAI_TARGETS_PATH).targets,
  live = false,
  cwd = process.cwd(),
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const rootHelp = runHelp(codexBin, ["--help"], { timeoutMs });
  const execHelp = runHelp(codexBin, ["exec", "--help"], { timeoutMs });
  const resumeHelp = runHelp(codexBin, ["exec", "resume", "--help"], { timeoutMs });

  const rootText = `${rootHelp.stdout}\n${rootHelp.stderr}`;
  const execText = `${execHelp.stdout}\n${execHelp.stderr}`;
  const resumeText = `${resumeHelp.stdout}\n${resumeHelp.stderr}`;
  const commandAvailable = rootHelp.ok;

  const capabilities = {
    interactiveModelAtLaunch: commandAvailable && hasOption(rootText, "--model"),
    execModelAtLaunch: execHelp.ok && hasOption(execText, "--model"),
    execResumeCommand: execHelp.ok && hasCommand(execText, "resume"),
    execResumeModelOverride: resumeHelp.ok && hasOption(resumeText, "--model"),
    execResumeLastSession: resumeHelp.ok && hasOption(resumeText, "--last"),
    jsonEvents: execHelp.ok && hasOption(execText, "--json")
  };

  const session = {
    mode: "plan",
    currentTargetId: null,
    turnCount: 0,
    routingOverride: "auto",
    vendorClient: "openai-codex",
    clientSurface: "codex-cli"
  };

  const first = routeTurnPlan({
    input: "Do not edit files or run commands. Briefly outline how you would implement retry logic with clear tests and error handling.",
    session,
    targets
  });
  if (first.route.status === "ok") {
    session.mode = first.route.mode;
    session.currentTargetId = first.route.selectedTargetId;
    session.turnCount += 1;
  }
  const second = routeTurnPlan({
    input: "Thanks, summarize the outcome briefly.",
    session,
    targets
  });

  const targetChanged = Boolean(
    first.route.selectedTargetId &&
    second.route.selectedTargetId &&
    first.route.selectedTargetId !== second.route.selectedTargetId
  );
  const resumeBoundaryRerouteSupported = Boolean(
    targetChanged &&
    capabilities.execResumeCommand &&
    capabilities.execResumeModelOverride &&
    capabilities.execResumeLastSession
  );

  const surfaceStatus = !commandAvailable
      ? "blocked"
      : resumeBoundaryRerouteSupported
      ? "partial"
      : "advisory_only";
  const liveProbe = live && surfaceStatus !== "blocked" ? runLiveResumeProbe({ codexBin, first, second, cwd, timeoutMs }) : null;
  const status = liveProbe ? liveProbe.status : surfaceStatus;

  return {
    status,
    surface: "codex-cli",
    mode: live ? "live_resume" : "command_surface",
    verdict: {
      authoritativeInsideRunningSession: false,
      resumeBoundaryRerouteSupported,
      nonInteractiveTurnRoutingSupported: Boolean(capabilities.execModelAtLaunch),
      advisorySupported: commandAvailable,
      targetChanged,
      liveResumeVerified: liveProbe?.status === "verified" || false
    },
    capabilities,
    turnPlans: [first, second],
    liveProbe,
    evidence: {
      commands: [
        { command: rootHelp.command, status: rootHelp.status, ok: rootHelp.ok },
        { command: execHelp.command, status: execHelp.status, ok: execHelp.ok },
        { command: resumeHelp.command, status: resumeHelp.status, ok: resumeHelp.ok }
      ],
      interpretation: resumeBoundaryRerouteSupported
        ? "Codex CLI appears to support route-selected model changes at exec/resume boundaries, not from inside an already-running interactive TUI."
        : "Codex CLI did not expose enough local command capability to prove route-selected model changes at a resume boundary."
    },
    limitations: live
      ? [
          "This probe does not prove model changes from inside an already-running Codex TUI session.",
          "A verified result requires shared session evidence in Codex CLI JSON/stdout/stderr output."
        ]
      : [
          "This probe does not execute live model calls.",
          "This probe does not prove model changes from inside an already-running Codex TUI session.",
          "A follow-up live probe should run two non-interactive Codex turns with resume and different --model values, then inspect JSON/session evidence."
        ]
  };
}

async function main() {
  const args = process.argv.slice(2);
  const codexBin = getArg(args, "--codex-bin") || "codex";
  const cwd = getArg(args, "--cwd") || process.cwd();
  const timeoutMs = Number(getArg(args, "--timeout-ms") || DEFAULT_TIMEOUT_MS);
  const result = runCodexCliFeasibilityProbe({ codexBin, live: hasFlag(args, "--live"), cwd, timeoutMs });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === "blocked" ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`codex-cli-feasibility-probe failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
