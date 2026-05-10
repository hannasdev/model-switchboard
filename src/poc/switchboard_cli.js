import { fileURLToPath } from "node:url";
import {
  executeSwitchboardContinuityProbe,
  executeSwitchboardTurn,
  planSwitchboardContinuityProbe,
  planSwitchboardTurn
} from "./switchboard_workflow.js";

function getArg(flag) {
  const idx = process.argv.lastIndexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

function printResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

function runTurn() {
  const input = getArg("--input") || process.argv.slice(3).join(" ") || "Compare tradeoffs and propose a plan.";
  const live = getArg("--live") === "true";
  const result = (live ? executeSwitchboardTurn : planSwitchboardTurn)({
    input,
    threadId: getArg("--thread-id") || "default",
    claudeBin: getArg("--claude-bin") || "claude",
    outputFormat: getArg("--output-format") || "json",
    noTools: getArg("--no-tools") === "true",
    timeoutMs: Number(getArg("--timeout-ms") || "180000")
  });
  printResult(result);
  if (result.status === "failed" || result.status === "refused") process.exitCode = 1;
}

function runContinuityProbe() {
  const live = getArg("--live") === "true";
  const options = {
    threadId: getArg("--thread-id") || "poc2-continuity",
    claudeBin: getArg("--claude-bin") || "claude",
    outputFormat: getArg("--output-format") || "json",
    noTools: getArg("--no-tools") === "true",
    timeoutMs: Number(getArg("--timeout-ms") || "180000"),
    interTurnDelayMs: Number(getArg("--inter-turn-delay-ms") || (live ? "2000" : "0"))
  };
  const firstInput = getArg("--first-input");
  const secondInput = getArg("--second-input");
  if (firstInput) options.firstInput = firstInput;
  if (secondInput) options.secondInput = secondInput;

  const result = (live ? executeSwitchboardContinuityProbe : planSwitchboardContinuityProbe)(options);
  printResult(result);
  if (result.status !== "verified") process.exitCode = 1;
}

function printUsage() {
  console.log("Usage:");
  console.log("  node src/poc/switchboard_cli.js turn --input \"Implement the plan.\"");
  console.log("  node src/poc/switchboard_cli.js continuity-probe");
  console.log("  node src/poc/switchboard_cli.js continuity-probe --live true");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2] || "turn";
  if (cmd === "turn") runTurn();
  else if (cmd === "continuity-probe") runContinuityProbe();
  else {
    printUsage();
    process.exitCode = 1;
  }
}
