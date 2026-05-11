import test from "node:test";
import assert from "node:assert/strict";
import { resolveSessionMode } from "../src/router/session_controller.js";

test("resolves proposed mode when there is no previous mode", () => {
  const resolution = resolveSessionMode({}, {
    proposedMode: "plan",
    explicitModeShift: false,
    modeStrongSignal: true
  });

  assert.deepEqual(resolution, {
    previousMode: null,
    proposedMode: "plan",
    resolvedMode: "plan",
    transitionReason: "no_previous_mode"
  });
});

test("respects explicit mode shifts", () => {
  const resolution = resolveSessionMode(
    { mode: "plan" },
    { proposedMode: "implement", explicitModeShift: true, modeStrongSignal: true }
  );

  assert.equal(resolution.resolvedMode, "implement");
  assert.equal(resolution.transitionReason, "explicit_task_signal");
});

test("preserves implementation mode on ambiguous turns", () => {
  const resolution = resolveSessionMode(
    { mode: "implement" },
    { proposedMode: "plan", explicitModeShift: false, modeStrongSignal: false }
  );

  assert.equal(resolution.resolvedMode, "implement");
  assert.equal(resolution.transitionReason, "preserve_current_mode_for_ambiguous_turn");
});

test("allows summarize mode for acknowledgement prompts", () => {
  const resolution = resolveSessionMode(
    { mode: "debug" },
    { proposedMode: "summarize", explicitModeShift: false, modeStrongSignal: true }
  );

  assert.equal(resolution.resolvedMode, "summarize");
  assert.equal(resolution.transitionReason, "acknowledgement_summary");
});

test("defaults unknown proposed modes to plan", () => {
  const resolution = resolveSessionMode(
    { mode: "plan" },
    { proposedMode: "nonexistent_mode", explicitModeShift: false, modeStrongSignal: true }
  );

  assert.equal(resolution.proposedMode, "plan");
  assert.equal(resolution.resolvedMode, "plan");
  assert.equal(resolution.transitionReason, "default_mode_resolution");
});
