import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routePrompt } from "../src/router/router.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, relPath), "utf8"));
}

const openaiTargets = readJson("../src/router/data/targets.openai.json").targets;
const fixtures = readJson("../src/router/data/fixtures.json");

test("fixtures map to expected route decisions", () => {
  for (const fx of fixtures) {
    let targets;
    if (fx.targetOverride === "quick_only") {
      targets = openaiTargets.filter((t) => t.label === "quick");
    } else if (fx.targetOverride === "coder_unavailable") {
      targets = openaiTargets.map((target) =>
        target.id === "openai-coder"
          ? { ...target, availability: "unavailable" }
          : target
      );
    } else {
      targets = openaiTargets;
    }

    const result = routePrompt({
      input: fx.input,
      session: fx.session,
      targets,
      executionSupported: false
    });

    assert.equal(result.mode, fx.expected.mode, `${fx.name} mode mismatch`);
    if (fx.expected.requiredCapabilities) {
      assert.deepEqual(
        result.requiredCapabilities,
        fx.expected.requiredCapabilities,
        `${fx.name} required capabilities mismatch`
      );
    }
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
    if (fx.expected.explanationIncludes) {
      for (const snippet of fx.expected.explanationIncludes) {
        assert.match(
          result.explanation,
          new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
          `${fx.name} explanation missing '${snippet}'`
        );
      }
    }
    if (fx.expected.classificationReason) {
      assert.equal(
        result.classification?.reason,
        fx.expected.classificationReason,
        `${fx.name} classification reason mismatch`
      );
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

test("ambiguous prompt preserves current implementation mode", () => {
  const result = routePrompt({
    input: "What does this config option mean?",
    session: {
      mode: "implement",
      currentTargetId: "openai-coder"
    },
    targets: openaiTargets,
    executionSupported: false
  });

  assert.equal(result.status, "ok");
  assert.equal(result.mode, "implement");
  assert.equal(result.modeResolution.transitionReason, "preserve_current_mode_for_ambiguous_turn");
  assert.equal(result.selectedTarget?.id, "openai-coder");
});

test("availability hard constraint can refuse otherwise-capable targets", () => {
  const degradedTargets = openaiTargets.map((target) =>
    target.id === "openai-coder"
      ? { ...target, availability: "unavailable" }
      : target
  );

  const result = routePrompt({
    input: "Implement the plan.",
    session: {
      mode: "plan",
      policyInputs: {
        hardConstraints: {
          availability: "enforced"
        }
      }
    },
    targets: degradedTargets,
    executionSupported: true
  });

  assert.equal(result.status, "refused");
  assert.equal(result.reason, "no_eligible_target");
  assert.equal(result.blocked.some((b) => b.id === "openai-coder"), true);
  assert.equal(
    result.blocked.some((b) => b.id === "openai-coder" && b.constraintReasons.includes("target_unavailable")),
    true
  );
});

test("high continuity cost avoids low-gain switching", () => {
  const result = routePrompt({
    input: "Plan the rollout in phases with tradeoffs.",
    session: {
      mode: "plan",
      turnCount: 10,
      currentTargetId: "openai-coder"
    },
    targets: openaiTargets,
    executionSupported: false
  });

  assert.equal(result.status, "ok");
  assert.equal(result.mode, "plan");
  assert.equal(result.continuityCost, "high");
  assert.equal(result.continuityDecision, "avoid_switch_due_to_continuity_cost");
  assert.equal(result.selectedTarget?.id, "openai-coder");
  assert.equal(result.shouldSwitch, false);
});

test("continuity metadata distinguishes missing current target from staying", () => {
  const result = routePrompt({
    input: "Plan the rollout in phases with tradeoffs.",
    session: {
      mode: "plan"
    },
    targets: openaiTargets,
    executionSupported: false
  });

  assert.equal(result.status, "ok");
  assert.equal(result.continuityDecision, "select_target_without_current_context");
  assert.equal(result.continuityReason, "no_current_target");
});

test("continuity metadata distinguishes ineligible current target from missing current target", () => {
  const degradedTargets = openaiTargets.map((target) =>
    target.id === "openai-coder"
      ? { ...target, availability: "unavailable" }
      : target
  );

  const result = routePrompt({
    input: "Plan the rollout in phases with tradeoffs.",
    session: {
      mode: "plan",
      currentTargetId: "openai-coder",
      policyInputs: {
        hardConstraints: {
          availability: "enforced"
        }
      }
    },
    targets: degradedTargets,
    executionSupported: false
  });

  assert.equal(result.status, "ok");
  assert.equal(result.continuityDecision, "select_target_without_current_context");
  assert.equal(result.continuityReason, "current_target_ineligible");
});

test("privacy hard constraint can refuse targets below required tier", () => {
  const result = routePrompt({
    input: "Implement the plan.",
    session: {
      mode: "plan",
      policyInputs: {
        hardConstraints: {
          privacy: "enforced",
          requiredPrivacyTier: "local"
        }
      }
    },
    targets: openaiTargets,
    executionSupported: true
  });

  assert.equal(result.status, "refused");
  assert.equal(
    result.blocked.some((b) => b.id === "openai-coder" && b.constraintReasons.includes("privacy_tier_below_required")),
    true
  );
});

test("client compatibility hard constraint can refuse incompatible client surfaces", () => {
  const surfaceScopedTargets = openaiTargets.map((target) => ({
    ...target,
    client_surfaces: ["claude-code-cli"]
  }));

  const result = routePrompt({
    input: "Implement the plan.",
    session: {
      mode: "plan",
      clientSurface: "copilot-chat",
      policyInputs: {
        hardConstraints: {
          clientCompatibility: "enforced"
        }
      }
    },
    targets: surfaceScopedTargets,
    executionSupported: true
  });

  assert.equal(result.status, "refused");
  assert.equal(
    result.blocked.some((b) => b.id === "openai-coder" && b.constraintReasons.includes("client_surface_incompatible")),
    true
  );
  assert.match(result.explanation, /hard constraints/);
});

test("stay override reports hard constraint blockers for ineligible current target", () => {
  const degradedTargets = openaiTargets.map((target) =>
    target.id === "openai-coder"
      ? { ...target, availability: "unavailable" }
      : target
  );

  const result = routePrompt({
    input: "Implement the plan.",
    session: {
      mode: "plan",
      currentTargetId: "openai-coder",
      routingOverride: "stay",
      policyInputs: {
        hardConstraints: {
          availability: "enforced"
        }
      }
    },
    targets: degradedTargets,
    executionSupported: true
  });

  assert.equal(result.status, "refused");
  assert.equal(result.routingOverride.requested, "stay");
  assert.equal(result.routingOverride.applied, false);
  assert.equal(result.routingOverride.reason, "current_target_blocked_by_hard_constraints");
});

test("low confidence escalates review routing", () => {
  const result = routePrompt({
    input: "Could you sanity check this?",
    session: {
      mode: "review"
    },
    targets: openaiTargets,
    executionSupported: false
  });

  assert.equal(result.status, "ok");
  assert.equal(result.mode, "review");
  assert.equal(result.escalationPolicy.applied, true);
  assert.equal(result.escalationPolicy.reasons.includes("low_confidence"), true);
  assert.equal(result.selectedTarget?.label, "best coder");
});

test("repeated failures trigger escalation", () => {
  const result = routePrompt({
    input: "Plan the rollout in phases with tradeoffs.",
    session: {
      mode: "plan",
      failureSignals: {
        recentToolFailures: 1,
        recentTestFailures: 2
      }
    },
    targets: openaiTargets,
    executionSupported: false
  });

  assert.equal(result.status, "ok");
  assert.equal(result.escalationPolicy.applied, true);
  assert.equal(result.escalationPolicy.reasons.includes("repeated_failures"), true);
  assert.equal(result.selectedTarget?.label, "best coder");
});

test("user correction trigger is explicit in escalation policy", () => {
  const result = routePrompt({
    input: "That is a wrong assumption. Compare alternatives again.",
    session: {
      mode: "plan"
    },
    targets: openaiTargets,
    executionSupported: false
  });

  assert.equal(result.status, "ok");
  assert.equal(result.escalationPolicy.applied, true);
  assert.equal(result.escalationPolicy.reasons.includes("user_correction"), true);
  assert.equal(result.escalationPolicy.reasons.includes("classification_escalation"), false);
  assert.equal(result.selectedTarget?.label, "best coder");
});

test("high-risk implementation is explicitly escalated", () => {
  const result = routePrompt({
    input: "Implement the plan.",
    session: {
      mode: "plan",
      riskLevel: "high"
    },
    targets: openaiTargets,
    executionSupported: false
  });

  assert.equal(result.status, "ok");
  assert.equal(result.mode, "implement");
  assert.equal(result.escalationPolicy.applied, true);
  assert.equal(result.escalationPolicy.reasons.includes("high_risk_implementation"), true);
  assert.equal(result.selectedTarget?.label, "best coder");
});

test("project override custom forceLabel is prioritized before fallback labels", () => {
  const balancedTarget = openaiTargets.find((target) => target.label === "balanced");
  assert.ok(balancedTarget, "expected balanced target fixture");

  const targets = [
    {
      ...balancedTarget,
      id: "custom-team-default",
      label: "team-default"
    },
    ...openaiTargets
  ];

  const result = routePrompt({
    input: "Plan the rollout in phases with tradeoffs.",
    session: {
      mode: "plan",
      projectOverride: {
        forceLabel: "team-default"
      }
    },
    targets,
    executionSupported: false
  });

  assert.equal(result.status, "ok");
  assert.equal(result.selectedTarget?.id, "custom-team-default");
  assert.equal(result.selectedTarget?.label, "team-default");
});
