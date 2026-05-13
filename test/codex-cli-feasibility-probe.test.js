import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCodexCliFeasibilityProbe } from "../scripts/codex-cli-feasibility-probe.js";

function createTargets() {
  return [
    {
      id: "openai-quick",
      label: "quick",
      target_class: "cheap_fast",
      capabilities: ["chat", "structured_output"],
      privacy_tier: "external",
      availability: "available"
    },
    {
      id: "openai-coder",
      label: "best coder",
      target_class: "strong_coding",
      capabilities: [
        "chat",
        "reasoning",
        "structured_output",
        "repo_context",
        "file_read",
        "file_edit",
        "shell_execution",
        "test_execution"
      ],
      privacy_tier: "external",
      availability: "available"
    }
  ];
}

function createFakeCodexBin() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-cli-probe-test-"));
  const binPath = path.join(dir, "codex");
  fs.writeFileSync(
    binPath,
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args.join(" ") === "--help") {
  console.log("Commands:\\n  exec            Run Codex non-interactively\\n  resume          Resume a previous interactive session\\nOptions:\\n  -m, --model <MODEL>\\n");
  process.exit(0);
}
if (args.join(" ") === "exec --help") {
  console.log("Commands:\\n  resume  Resume a previous session\\nOptions:\\n  -m, --model <MODEL>\\n      --json\\n");
  process.exit(0);
}
if (args.join(" ") === "exec resume --help") {
  console.log("Options:\\n      --last\\n  -m, --model <MODEL>\\n      --json\\n");
  process.exit(0);
}
if (args[0] === "exec" && args[1] === "--model") {
  const outputPath = args[args.indexOf("--output-last-message") + 1];
  fs.writeFileSync(outputPath, "implemented retry logic");
  console.log(JSON.stringify({ type: "session", session_id: "11111111-1111-4111-8111-111111111111" }));
  console.log(JSON.stringify({ type: "turn_complete", model: args[2] }));
  process.exit(0);
}
if (args[0] === "exec" && args[1] === "resume" && args.includes("--last")) {
  const outputPath = args[args.indexOf("--output-last-message") + 1];
  fs.writeFileSync(outputPath, "summarized outcome");
  console.log(JSON.stringify({ type: "session", session_id: "11111111-1111-4111-8111-111111111111" }));
  console.log(JSON.stringify({ type: "turn_complete", model: args[args.indexOf("--model") + 1] }));
  process.exit(0);
}
process.exit(2);
`,
    "utf8"
  );
  fs.chmodSync(binPath, 0o755);
  return binPath;
}

test("codex CLI feasibility probe reports resume-boundary routing without claiming in-session authority", () => {
  const result = runCodexCliFeasibilityProbe({
    codexBin: createFakeCodexBin(),
    targets: createTargets()
  });

  assert.equal(result.surface, "codex-cli");
  assert.equal(result.status, "partial");
  assert.equal(result.verdict.authoritativeInsideRunningSession, false);
  assert.equal(result.verdict.resumeBoundaryRerouteSupported, true);
  assert.equal(result.verdict.nonInteractiveTurnRoutingSupported, true);
  assert.equal(result.verdict.targetChanged, true);
  assert.equal(result.turnPlans[0].route.selectedTargetId, "openai-coder");
  assert.equal(result.turnPlans[1].route.selectedTargetId, "openai-quick");
});

test("codex CLI live feasibility probe verifies resumed turns only with shared session evidence", () => {
  const result = runCodexCliFeasibilityProbe({
    codexBin: createFakeCodexBin(),
    targets: createTargets(),
    live: true
  });

  assert.equal(result.mode, "live_resume");
  assert.equal(result.status, "verified");
  assert.equal(result.verdict.liveResumeVerified, true);
  assert.equal(result.liveProbe.modelChanged, true);
  assert.equal(result.liveProbe.continuityEvidence, "shared_session_id");
  assert.deepEqual(result.liveProbe.sharedSessionIds, ["11111111-1111-4111-8111-111111111111"]);
  assert.equal(result.liveProbe.turns[0].selectedTargetId, "openai-coder");
  assert.equal(result.liveProbe.turns[1].selectedTargetId, "openai-quick");
  assert.equal(result.liveProbe.turns[0].finalMessageBytes > 0, true);
  assert.equal(result.liveProbe.turns[1].finalMessageBytes > 0, true);
});
