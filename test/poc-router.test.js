import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routePrompt } from "../src/poc/router.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, relPath), "utf8"));
}

const openaiTargets = readJson("../src/poc/data/targets.openai.json").targets;
const fixtures = readJson("../src/poc/data/fixtures.json");

test("fixtures map to expected route decisions", () => {
  for (const fx of fixtures) {
    const targets =
      fx.targetOverride === "quick_only"
        ? openaiTargets.filter((t) => t.label === "quick")
        : openaiTargets;

    const result = routePrompt({
      input: fx.input,
      session: fx.session,
      targets,
      executionSupported: false
    });

    assert.equal(result.mode, fx.expected.mode, `${fx.name} mode mismatch`);
    if (fx.expected.status) {
      assert.equal(result.status, fx.expected.status, `${fx.name} status mismatch`);
    }
    if (fx.expected.label) {
      assert.equal(
        result.selectedTarget?.label,
        fx.expected.label,
        `${fx.name} selected label mismatch`
      );
    }
    if (typeof fx.expected.shouldSwitch === "boolean") {
      assert.equal(result.shouldSwitch, fx.expected.shouldSwitch, `${fx.name} switch mismatch`);
    }
  }
});

test("route refusal when no target satisfies required capabilities", () => {
  const quickOnly = openaiTargets.filter((t) => t.label === "quick");
  const result = routePrompt({
    input: "Implement the plan.",
    session: { mode: "plan" },
    targets: quickOnly
  });
  assert.equal(result.status, "refused");
  assert.equal(result.mode, "implement");
});
