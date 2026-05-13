#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { routePrompt } from "../src/router/router.js";
import { OPENAI_TARGETS_PATH } from "../src/switchboard/paths.js";
import { getProfileModelMap, getTargetProfileMap } from "../src/adapters/model-mappings.js";

const TARGET_TO_PROFILE = getTargetProfileMap("openai-codex");
const PROFILE_TO_MODEL = getProfileModelMap("openai-codex");

function readJson(filePath) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- probe reads the known targets path or explicit test fixture path.
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getArg(args, flag) {
  const idx = args.lastIndexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function runHelp(codexBin, args) {
  const result = spawnSync(codexBin, args, {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" }
  });
  return {
    command: [codexBin, ...args].join(" "),
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
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

export function runCodexCliFeasibilityProbe({
  codexBin = "codex",
  targets = readJson(OPENAI_TARGETS_PATH).targets
} = {}) {
  const rootHelp = runHelp(codexBin, ["--help"]);
  const execHelp = runHelp(codexBin, ["exec", "--help"]);
  const resumeHelp = runHelp(codexBin, ["exec", "resume", "--help"]);

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
    input: "Implement the retry logic with clear tests and error handling.",
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

  return {
    status: !commandAvailable
      ? "blocked"
      : resumeBoundaryRerouteSupported
      ? "partial"
      : "advisory_only",
    surface: "codex-cli",
    verdict: {
      authoritativeInsideRunningSession: false,
      resumeBoundaryRerouteSupported,
      nonInteractiveTurnRoutingSupported: Boolean(capabilities.execModelAtLaunch),
      advisorySupported: commandAvailable,
      targetChanged
    },
    capabilities,
    turnPlans: [first, second],
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
    limitations: [
      "This probe does not execute live model calls.",
      "This probe does not prove model changes from inside an already-running Codex TUI session.",
      "A follow-up live probe should run two non-interactive Codex turns with resume and different --model values, then inspect JSON/session evidence."
    ]
  };
}

async function main() {
  const args = process.argv.slice(2);
  const codexBin = getArg(args, "--codex-bin") || "codex";
  const result = runCodexCliFeasibilityProbe({ codexBin });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === "blocked" ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`codex-cli-feasibility-probe failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
