# Session-Aware AI Router MVP PRD

The latest PoC learning is captured in [PoC Outcome Analysis](POC-OUTCOME-ANALYSIS.md). That document supersedes the earlier generic vendor-router direction.

This PRD is intentionally conceptual. The next milestone is not a small MVP; it is PoC 2, whose job is to verify or falsify the remaining assumptions behind the Claude Code wrapper and hook architecture.

## 1. Product Summary

Software engineers have access to many capable AI models and coding surfaces, but choosing the right model or effort level for every turn is a repeated cognitive tax.

The MVP direction is a Claude Code-scoped Switchboard:

```text
User
  -> switchboard wrapper
  -> router policy
  -> Claude CLI launch/resume with selected model/effort
  -> Claude Code hooks for explanation, logging, and tool governance
```

The product promise is:

```text
Use Claude Code normally through Switchboard. Switchboard chooses the model/effort before the turn, explains the choice, and preserves Claude's safety posture while adding route-aware visibility.
```

The MVP should not promise in-session automatic model switching. The current evidence suggests model/effort authority belongs at the launch or resume boundary. Hooks are useful for visibility, context injection, logging, and tool governance, but should be treated as advisory inside an already-running Claude session.

## 2. User Problem

The primary pain is model-choice fatigue:

* Stronger models are valuable for implementation, debugging, high-risk review, and architectural ambiguity.
* Faster or cheaper models are enough for acknowledgements, summaries, simple explanation, and low-risk turns.
* Users do not want to track changing vendor model names, effort flags, and client-specific capabilities.
* The right choice depends on task intent, continuity, tool needs, cost posture, and current session state.

The secondary pain is continuity. Routing is only useful if the user still feels like they are working in one coherent coding session rather than hopping between disconnected tools.

## 3. Target User

The first user is a high-context software engineer who already uses Claude Code and is comfortable with early local tooling.

The broader audience is engineers who want good defaults, a short explanation, and an escape hatch when they care enough to override.

The MVP should feel like a normal way to launch or use Claude Code, not like a bundle of PoC commands.

## 4. Current Evidence

The first PoC supports the following:

* Deterministic local routing works for `quick`, `balanced`, and `best coder`.
* Compact route explanations are suitable for user-facing output.
* Capability filtering and refusal paths can be deterministic.
* Claude Code hooks can observe prompts and tool calls before execution.
* Claude Code hooks can inject context and allow or deny tool calls.
* Claude CLI launch flags can influence model/effort before execution.
* Local gateway continuity and logging are feasible in a router-owned harness.

The first PoC did not prove:

* Automatic model/effort switching inside an active Claude Code turn.
* A satisfying continuity model across routed Claude wrapper turns.
* A seamless `switchboard` user experience.
* A production-ready wrapper trust boundary.

## 5. PoC 2 Scope

PoC 2 exists to prove the missing gaps, not to build a small MVP.

PoC 2 should include:

1. A minimal `switchboard` wrapper command for Claude Code.
2. A two-turn continuity probe across routed turns.
3. Route selection at Claude launch or resume time using model/effort flags.
4. Claude hooks that display or inject route context and log tool decisions.
5. Local evidence logs that distinguish user prompt, route decision, wrapper context, selected model/effort, session identity, and hook events.
6. A concise PoC 2 outcome write-up with verified assumptions, falsified assumptions, and MVP implications.

PoC 2 should not include:

* Cross-vendor routing.
* Rich UI.
* Learned routing.
* Automatic context packaging beyond the minimum needed for the continuity probe.
* Production-grade security policy.
* Broad tool permission automation.
* Full gateway execution as the primary UX.
* Polished override ergonomics beyond the minimum needed to test the workflow.

Security is an architectural consideration because the wrapper can influence execution, but PoC 2 does not need to solve the full security model. It only needs to avoid adding unnecessary authority and record enough evidence to inform the later design.

## 6. Assumptions To Verify Or Falsify

### A. Wrapper Routing Authority

Assumption: Switchboard can choose Claude model/effort before execution by launching or resuming Claude with explicit flags.

Verification:

* `quick` routes to the intended lower-cost/lower-effort Claude target.
* `best coder` routes to the intended stronger/higher-effort Claude target.
* The evidence log records the selected route and the actual model/effort used.

Falsification:

* Claude ignores the selected flags.
* The wrapper cannot reliably prove which model/effort executed.
* The launch/resume path is too brittle for normal use.

### B. Claude Continuity

Assumption: The wrapper can preserve a user's sense of one ongoing Claude Code session while routing different turns to different model/effort choices.

Verification:

* Turn one can route to `best coder` and create or resume a Claude session.
* Turn two can route to `quick` or `balanced`.
* The second turn retains enough project/session context to feel coherent.
* The user does not need to manually reconstruct settled context.

Falsification:

* Changing model/effort breaks session continuity.
* Resume semantics do not work with routed turns.
* The required context handoff is so manual that it reintroduces cognitive overhead.

### C. Hook Usefulness

Assumption: Claude hooks are useful for route explanation, context visibility, tool-decision logging, and basic governance even if they cannot switch the active model.

Verification:

* `UserPromptSubmit` sees the prompt early enough to add a labeled Switchboard context block or explanation.
* `PreToolUse` sees tool calls early enough to log and, where appropriate, deny them.
* Hook logs can be correlated with wrapper route decisions and Claude session identity.

Falsification:

* Hook timing is too late or inconsistent.
* Injected route context is noisy or confusing.
* Hook events cannot be correlated with the wrapper session.

### D. Seamless CLI Shape

Assumption: A first-class command can hide PoC wiring without hiding important routing evidence.

Verification:

* `switchboard "prompt"` works for a single-turn prompt.
* `switchboard` can start or resume an interactive Claude flow.
* The user sees a short route explanation such as `Switchboard: best coder - repo edits - higher effort`.
* Detailed route state is available in logs or an explain command.

Falsification:

* The command requires users to understand multiple wrapper modes.
* The route explanation is too noisy for normal use.
* The workflow feels materially worse than invoking Claude directly.

### E. Routing Policy Fit

Assumption: The existing deterministic policy is good enough for the Claude-scoped workflow after target labels map to Claude model/effort choices.

Verification:

* Low-risk turns route to `quick`.
* Planning routes to `balanced`.
* Implementation and debugging route to `best coder`.
* Capability misses refuse clearly.
* The router avoids twitchy switching when continuity matters more than marginal cost savings.

Falsification:

* Claude-specific model/effort options do not map cleanly to current labels.
* The policy switches too often in interactive use.
* The explanation does not match the user's intuition.

### F. Minimal Evidence And Auditability

Assumption: PoC 2 can collect enough evidence to make a confident MVP decision.

Verification:

* Logs show route decision, selected Claude flags, session identity, hook events, and any tool decision.
* Logs distinguish user prompt from Switchboard-generated context.
* Failures are explicit rather than silently falling back.

Falsification:

* Logs cannot prove what happened.
* Wrapper and hook evidence cannot be correlated.
* Failure modes are ambiguous.

## 7. MVP Scope If PoC 2 Passes

If PoC 2 verifies the key assumptions, the MVP should include:

1. A `switchboard` command that wraps Claude Code.
2. Claude-scoped target labels: `quick`, `balanced`, and `best coder`.
3. Pre-launch or pre-resume routing to Claude model/effort flags.
4. Minimal persistent local session state.
5. Compact route explanations.
6. Basic override controls: stronger, cheaper, stay, auto, explain.
7. Claude hooks for route context, tool-decision logging, and conservative governance.
8. Local route and hook logs.
9. A documented wrapper threat model before production hardening.

The MVP should defer:

* Cross-vendor routing.
* In-session automatic model switching.
* `deep reasoning` as a standalone user-facing target unless Claude exposes a meaningful distinction.
* Learned routing.
* Rich UI.
* Broad tool permission automation.
* Automatic context packaging.
* Full gateway execution as the primary product surface.

## 8. Conceptual Routing Model

Start with these user-facing labels:

* `quick`
* `balanced`
* `best coder`

Keep `deep reasoning` out of the initial Claude-scoped MVP unless PoC 2 or later vendor research shows a clear product distinction from `balanced` or `best coder`.

Start with these modes:

* `plan`
* `implement`
* `debug`
* `review`
* `summarize`
* `agent_workflow`
* `out_of_domain`

Initial policy:

```yaml
routes:
  summarize: quick
  plan: balanced
  review: balanced
  agent_workflow: balanced
  out_of_domain: balanced
  implement: best coder
  debug: best coder

escalation:
  user_requests_stronger: best coder
  implementation_approved: best coder
  repeated_test_failure: best coder
  high_risk_paths: best coder
  low_classifier_confidence: balanced
```

The policy should prefer continuity when the current target is capable enough and the expected quality gain from switching is small.

## 9. UX Direction

The default command should be simple:

```bash
switchboard
```

or:

```bash
switchboard "Implement the plan."
```

The route explanation should be short:

```text
Switchboard: best coder - repo edits - higher effort
```

Detailed route state belongs in logs or an explicit explain command.

The user should be able to express simple controls without learning model names:

* Use stronger target for this.
* Prefer cheaper unless quality is at risk.
* Stay on this target for now.
* Return to auto.
* Explain the route.

## 10. MVP Acceptance Criteria

The MVP is acceptable when:

1. A user can start or resume Claude Code through `switchboard`.
2. Switchboard routes before execution to the selected Claude model/effort.
3. The route explanation is visible and compact.
4. The user can override routing at a coarse label level.
5. Session continuity is good enough for normal multi-turn coding work.
6. Hook evidence correlates with wrapper route decisions.
7. Logs distinguish user input, Switchboard context, route decisions, model/effort selection, and tool decisions.
8. Failure modes are clear and fail closed where routing or hook setup cannot be trusted.

## 11. Relationship To Other Docs

[PoC](POC.md) describes the original risk-reduction plan.

[PoC Outcome Analysis](POC-OUTCOME-ANALYSIS.md) is the current source of truth for what the first PoC proved and how the product direction changed.

[Architecture and Design Document](PRD.md) remains broader product context. It should not be treated as MVP scope unless this PRD explicitly includes the feature.
