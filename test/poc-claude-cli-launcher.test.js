import test from "node:test";
import assert from "node:assert/strict";
import { getClaudeCliTargetSelection, planClaudeCliLaunch } from "../src/poc/claude_cli_launcher.js";

test("Claude CLI launcher maps quick route to haiku", () => {
  const plan = planClaudeCliLaunch({
    input: "Thanks, that makes sense.",
    sessionId: "00000000-0000-4000-8000-000000000001",
    cwd: "/repo"
  });

  assert.equal(plan.status, "planned");
  assert.equal(plan.selectedTarget.label, "quick");
  assert.equal(plan.selectedTarget.model, "haiku");
  assert.equal(plan.selectedTarget.effort, "low");
  assert.deepEqual(plan.args.slice(0, 7), [
    "--print",
    "--output-format",
    "json",
    "--model",
    "haiku",
    "--effort",
    "low"
  ]);
});

test("Claude CLI launcher maps implementation route to sonnet high effort", () => {
  const plan = planClaudeCliLaunch({
    input: "Implement the plan.",
    sessionId: "00000000-0000-4000-8000-000000000002",
    cwd: "/repo"
  });

  assert.equal(plan.status, "planned");
  assert.equal(plan.selectedTarget.label, "best coder");
  assert.equal(plan.selectedTarget.model, "sonnet");
  assert.equal(plan.selectedTarget.effort, "high");
  assert.equal(plan.args.includes("--model"), true);
  assert.equal(plan.args.includes("sonnet"), true);
});

test("Claude CLI target mapping is explicit", () => {
  assert.deepEqual(getClaudeCliTargetSelection("anthropic-balanced"), {
    model: "sonnet",
    effort: "medium"
  });
  assert.equal(getClaudeCliTargetSelection("missing-target"), null);
});

test("Claude CLI launcher can disable tools for model-selection probes", () => {
  const plan = planClaudeCliLaunch({
    input: "Implement the plan. Do not use tools; reply exactly OK.",
    sessionId: "00000000-0000-4000-8000-000000000003",
    cwd: "/repo",
    noTools: true
  });

  assert.equal(plan.status, "planned");
  assert.equal(plan.selectedTarget.label, "best coder");
  assert.deepEqual(plan.args.slice(-2), ["--tools=", "Implement the plan. Do not use tools; reply exactly OK."]);
});
