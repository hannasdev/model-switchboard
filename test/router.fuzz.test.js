import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { routePrompt } from "../src/router/router.js";

const CAPABILITIES = [
  "chat",
  "reasoning",
  "structured_output",
  "repo_context",
  "file_read",
  "file_edit",
  "shell_execution",
  "test_execution"
];

const TARGET_LABELS = ["quick", "balanced", "deep reasoning", "best coder"];
const OVERRIDES = ["auto", "stronger", "cheaper", "stay"];

const arbitraryTarget = fc.record({
  id: fc.string({ minLength: 1, maxLength: 30 }),
  label: fc.constantFrom(...TARGET_LABELS),
  capabilities: fc.uniqueArray(fc.constantFrom(...CAPABILITIES), { maxLength: CAPABILITIES.length })
});

const arbitrarySession = fc.record({
  currentTargetId: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  routingOverride: fc.constantFrom(...OVERRIDES)
});

test("routePrompt fuzz: returns stable shape and respects capability requirements", () => {
  fc.assert(
    fc.property(
      fc.string({ maxLength: 500 }),
      arbitrarySession,
      fc.uniqueArray(arbitraryTarget, {
        maxLength: 8,
        selector: (target) => target.id
      }),
      fc.boolean(),
      (input, session, targets, executionSupported) => {
        const result = routePrompt({
          input,
          session,
          targets,
          executionSupported
        });

        assert.ok(result);
        assert.ok(["ok", "refused"].includes(result.status));
        assert.ok(Array.isArray(result.requiredCapabilities));

        if (result.status === "ok") {
          assert.ok(result.selectedTarget);
          for (const capability of result.requiredCapabilities) {
            assert.ok(
              result.selectedTarget.capabilities.includes(capability),
              `selected target missing required capability: ${capability}`
            );
          }
        } else {
          assert.equal(result.reason, "no_eligible_target");
          assert.equal(result.selectedTarget, undefined);
          assert.ok(result.explanation.length > 0);
        }
      }
    ),
    {
      // Keep runtime short in CI while still exploring many input shapes.
      numRuns: 300
    }
  );
});
