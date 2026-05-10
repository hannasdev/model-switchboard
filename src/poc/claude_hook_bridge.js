import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routePrompt } from "./router.js";
import { loadRouteContext } from "./switchboard_route_context.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DEFAULT_CLAUDE_HOOK_LOG_PATH = path.join(__dirname, "logs", "claude-hook-events.ndjson");
const ANTHROPIC_TARGETS_PATH = path.join(__dirname, "data", "targets.anthropic.json");

function readStdin() {
  return new Promise((resolve, reject) => {
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      text += chunk;
    });
    process.stdin.on("end", () => resolve(text));
    process.stdin.on("error", reject);
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function appendLog(entry, logPath = DEFAULT_CLAUDE_HOOK_LOG_PATH) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

function routeContextText(routeResult) {
  const target = routeResult.selectedTarget?.label || "none";
  const capabilityList = (routeResult.requiredCapabilities || []).join(", ");
  return [
    "Router decision for this Claude Code turn:",
    routeResult.explanation,
    `Mode: ${routeResult.mode}`,
    `Target label: ${target}`,
    `Required capabilities: ${capabilityList || "none"}`,
    "Treat this as advisory unless the client exposes a supported target-switching API."
  ].join("\n");
}

function correlatedRouteContextText(correlation) {
  const latest = correlation.context?.latest;
  if (!latest) return null;
  return [
    "Switchboard wrapper route for this Claude Code session:",
    `Thread: ${latest.threadId || "unknown"}`,
    `Target label: ${latest.routeLabel || "unknown"}`,
    `Claude model/effort: ${latest.model || "unknown"}/${latest.effort || "unknown"}`,
    latest.wrapperContext?.text ? `Summary: ${latest.wrapperContext.text}` : null
  ].filter(Boolean).join("\n");
}

function buildSession(hookInput) {
  return {
    vendorClient: "claude-code",
    sessionId: hookInput.session_id || null,
    currentTargetId: "anthropic-balanced",
    permissionMode: hookInput.permission_mode || null,
    transcriptPath: hookInput.transcript_path || null
  };
}

function createUserPromptSubmitOutput(routeResult, correlation) {
  if (routeResult.status === "refused") {
    return {
      continue: false,
      stopReason: routeResult.explanation,
      systemMessage: "Router blocked this prompt because no configured Claude target satisfies it."
    };
  }

  const correlatedText = correlatedRouteContextText(correlation);
  const additionalContext = correlatedText
    ? `${correlatedText}\n\n${routeContextText(routeResult)}`
    : routeContextText(routeResult);

  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext
    }
  };
}

function isDangerousShellCommand(command) {
  return /\brm\s+-rf\b/.test(command) || /\bsudo\b/.test(command);
}

function createPreToolUseOutput(hookInput) {
  const toolName = hookInput.tool_name || "unknown";
  const command = hookInput.tool_input?.command || "";

  if (toolName === "Bash" && isDangerousShellCommand(command)) {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "Router capability policy blocks destructive or privileged shell commands in this probe."
      }
    };
  }

  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: `Router observed ${toolName} before execution and allowed it for this probe.`
    }
  };
}

export function handleClaudeHookInput(hookInput, options = {}) {
  const targets = options.targets || readJson(ANTHROPIC_TARGETS_PATH).targets;
  const eventName = hookInput.hook_event_name;
  const correlation = loadRouteContext({
    storePath: options.routeContextPath,
    claudeSessionId: hookInput.session_id || null
  });

  if (eventName === "UserPromptSubmit") {
    const input = hookInput.prompt || "";
    const routeResult = routePrompt({
      input,
      targets,
      session: buildSession(hookInput),
      executionSupported: false
    });
    const output = createUserPromptSubmitOutput(routeResult, correlation);
    appendLog(
      {
        ts: new Date().toISOString(),
        source: "claude_code_hook",
        event: eventName,
        cwd: hookInput.cwd || null,
        sessionId: hookInput.session_id || null,
        transcriptPath: hookInput.transcript_path || null,
        correlation,
        prompt: input,
        route: routeResult,
        output
      },
      options.logPath
    );
    return output;
  }

  if (eventName === "PreToolUse") {
    const output = createPreToolUseOutput(hookInput);
    appendLog(
      {
        ts: new Date().toISOString(),
        source: "claude_code_hook",
        event: eventName,
        cwd: hookInput.cwd || null,
        sessionId: hookInput.session_id || null,
        transcriptPath: hookInput.transcript_path || null,
        correlation,
        toolName: hookInput.tool_name || null,
        toolInput: hookInput.tool_input || null,
        output
      },
      options.logPath
    );
    return output;
  }

  const output = { continue: true };
  appendLog(
    {
      ts: new Date().toISOString(),
      source: "claude_code_hook",
      event: eventName || "unknown",
      correlation,
      output
    },
    options.logPath
  );
  return output;
}

async function main() {
  const raw = await readStdin();
  const hookInput = raw.trim() ? JSON.parse(raw) : {};
  const output = handleClaudeHookInput(hookInput);
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || String(error));
    process.exit(1);
  });
}
