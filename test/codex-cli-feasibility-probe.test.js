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
