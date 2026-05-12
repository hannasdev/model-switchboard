# Session-Aware AI Router MVP PRD

The latest PoC learning is captured in [PoC Outcome Analysis](archive/POC-OUTCOME-ANALYSIS.md) and the executable evidence summarized in [PoC Implementation Notes](archive/POC-IMPLEMENTATION.md). Those documents supersede the earlier generic vendor-router direction.

## Status Snapshot

This document is still relevant as the scoped MVP product slice and the record of the assumptions that were validated by PoC 2 and the early Switchboard workflow. It is no longer the best source of truth for current implementation status; use [PRD.md](PRD.md), [ROUTER-PHASE-PLAN.md](ROUTER-PHASE-PLAN.md), and the milestone logs for the up-to-date state.

This PRD is intentionally scoped to the first product slice. PoC 2 has now verified enough of the Claude Code wrapper and hook architecture to proceed toward an MVP, with one important boundary: the verified path is prompt-driven non-interactive Claude CLI launch/resume, not a fully polished interactive Claude replacement.

## 1. Product Summary

Software engineers have access to many capable AI models and coding surfaces, but choosing the right model or effort level for every turn is a repeated cognitive tax.

There are two related product layers:

1. `@model-switchboard/router`: a standalone routing engine for choosing among model targets.
2. `@model-switchboard/claude-code`: a Claude Code workflow integration that uses the router.

The MVP direction is the first applied workflow product: a Claude Code-scoped Switchboard built on a separable router core.

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

The router should remain reusable outside software-development workflows. The MVP should focus on Claude Code because that is the current highest-confidence integration path, but target registry, classification, policy, capability filtering, route explanation, and refusal logic should stay independent of Claude-specific launch, hook, and session mechanics.

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
* A seamless `switchboard` user experience.
* A production-ready wrapper trust boundary.

PoC 2 added the following evidence:

* A planned Switchboard workflow can route Claude turns while keeping router policy independent of Claude launch mechanics.
* Two routed non-interactive Claude CLI turns can share one Claude session id while changing route labels and model/effort flags.
* The working resume pattern is `--session-id` for the first turn and `--resume <session-id>` for later turns.
* Live continuity evidence shows the second routed turn can recover first-turn context.
* Wrapper route metadata can be written before launch and correlated with live `UserPromptSubmit` and `PreToolUse` hook events by Claude session id.
* Hook correlation can support injected route context and route-aware tool-decision logs.

PoC 2 still did not prove:

* A polished end-user `switchboard` command.
* A fully interactive Claude session UX.
* Hardened production tool-governance policy.
* Router package extraction.

## 5. PoC 2 Result And Remaining Validation

PoC 2 has shifted from an open gating experiment to implementation evidence for the MVP.

Verified:

1. Route selection at Claude launch or resume time using model/effort flags.
2. Two-turn non-interactive continuity across routed turns.
3. Route-context correlation between wrapper decisions and Claude hooks.
4. Local evidence logs that distinguish route decision, wrapper context, selected model/effort, Claude session identity, and hook events.
5. A clean enough router/workflow boundary to continue productization without trapping policy inside Claude-specific code.

Remaining validation before calling the MVP shippable:

All items resolved. See Section 8 for implementation status and [PoC Outcome Analysis](archive/POC-OUTCOME-ANALYSIS.md) for the PoC 2 outcome summary with MVP implications.

1. ~~Replace PoC npm commands with a first-class `switchboard` command.~~ Done.
2. ~~Decide whether the initial MVP supports prompt-driven turns only, or also supports a no-prompt interactive mode.~~ Done: both prompt-driven and `--interactive` modes are implemented and live-verified.
3. ~~Harden failure behavior when Claude auth, hook setup, or route-context correlation is unavailable.~~ Done: CLI fails closed pre-launch; hook policy fails closed without matched route context.
4. ~~Define the minimum production tool-governance policy.~~ Done: documented in [Switchboard Wrapper Threat Model](WRAPPER-THREAT-MODEL.md).
5. ~~Write a concise PoC 2 outcome summary with MVP implications.~~ Done: captured in [PoC Outcome Analysis](archive/POC-OUTCOME-ANALYSIS.md).

The MVP should still not include:

* Cross-vendor routing.
* Rich UI.
* Learned routing.
* Automatic context packaging beyond the minimum needed for continuity.
* Production-grade security policy beyond the wrapper threat model and conservative defaults.
* Broad tool permission automation.
* Full gateway execution as the primary UX.
* Router package extraction.

Security is now an MVP design requirement because the wrapper can influence execution. The MVP does not need full enterprise policy, but it must avoid hidden authority expansion, fail closed when route/hook trust cannot be established, and record enough evidence for a user to audit what happened.

## 6. Product Packaging Direction

Longer term, the router and workflow integration may become separate packages under one namespace:

```text
@model-switchboard/router
@model-switchboard/claude-code
@model-switchboard/cli
```

`@model-switchboard/router` should solve the limited routing problem well:

* target registry schema
* task/mode classification interface
* deterministic routing policy
* capability filtering
* cost, privacy, latency, and availability constraints
* route explanations
* refusal reasons
* fixture-based policy tests

It should not know about Claude Code hooks, CLI launch flags, terminal workflow, local transcript paths, or software-development-specific UI.

`@model-switchboard/claude-code` should solve the workflow integration problem:

* `switchboard` command
* Claude model/effort mapping
* launch and resume behavior
* hook setup and correlation
* session continuity
* route display
* override UX
* local route and hook logs
* Claude-specific safety boundaries

Sequence:

1. Productize the Claude Code workflow inside this repo while preserving the router/workflow boundary.
2. Use the MVP to harden the router boundary and API shape under real usage.
3. Extract and productize `@model-switchboard/router` as a public package once the boundary has survived real workflow pressure.
4. Continue Claude Code work as a dependency of the router package.

## 7. Assumptions To Verify Or Falsify

### A. Wrapper Routing Authority

Assumption: Switchboard can choose Claude model/effort before execution by launching or resuming Claude with explicit flags.

Verification:

* `quick` routes to the intended lower-cost/lower-effort Claude target.
* `best coder` routes to the intended stronger/higher-effort Claude target.
* The evidence log records the selected route and the actual model/effort used.

Status: verified through PoC harnesses and the MVP `switchboard` command live path. Remaining productization work is structural cleanup, setup ergonomics, and broader UX polish.

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

Status: fully verified for both non-interactive and interactive CLI turns.

Non-interactive: verified using `--session-id` on the first turn and `--resume <session-id>` on the second turn.

Interactive: verified in a live environment on 2026-05-10 using `switchboard --interactive`. Evidence:

* Same `claudeSessionId` (`83719220-d3cd-4d24-a658-220670e59d62`) across both turns.
* Turn one launched with `--session-id`, turn two resumed with `--resume`.
* `turnCount` advanced from 1 to 2 for the same thread.
* Route context matched. Hook events correlated: `UserPromptSubmit` and `PreToolUse` both matched the session.
* Chat history from turn one was visible in turn two inside Claude.

A first-class probe command (`switchboard probe continuity-interactive`) exists for ongoing verification with automated checks for session reuse, resume semantics, and turn count advancement. Stale-resume recovery is also implemented: if Claude no longer holds the session id, the wrapper automatically retries with a fresh `--session-id`.

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

Status: verified for live `UserPromptSubmit` and `PreToolUse` correlation by Claude session id. Production policy hardening remains.

Falsification:

* Hook timing is too late or inconsistent.
* Injected route context is noisy or confusing.
* Hook events cannot be correlated with the wrapper session.

### D. Seamless CLI Shape

Assumption: A first-class command can hide PoC wiring without hiding important routing evidence.

Verification:

* `switchboard "prompt"` works for a single-turn prompt.
* `switchboard "prompt"` can create or resume a Claude session while hiding PoC wiring.
* The user sees a short route explanation such as `Switchboard: best coder - repo edits - higher effort`.
* Detailed route state is available in logs or an explain command.

Interactive no-prompt usage is now implemented as a first-class command path (`switchboard --interactive`) and probe (`switchboard probe continuity-interactive`). Prompt-driven routed turns remain the core verified MVP wedge; interactive behavior should be confirmed in live environments via the probe.

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

Status: partially verified. Route and hook correlation are proven in PoC 2; MVP implementation must make the evidence accessible through stable local logs and an explain path.

Falsification:

* Logs cannot prove what happened.
* Wrapper and hook evidence cannot be correlated.
* Failure modes are ambiguous.

## 8. MVP Scope Based On PoC 2

The MVP should include:

1. A `switchboard` command that wraps Claude Code. Status: implemented.
2. Claude-scoped target labels: `quick`, `balanced`, and `best coder`.
3. Pre-launch or pre-resume routing to Claude model/effort flags. Status: implemented and live-verified.
4. Correct Claude continuity semantics: create the first turn with `--session-id`, resume later turns with `--resume <session-id>`. Status: implemented and live-verified.
5. Route-context writes before Claude launch so hooks can correlate against wrapper decisions. Status: implemented.
6. Minimal persistent local session state. Status: implemented.
7. Compact route explanations. Status: implemented.
8. Basic override controls: stronger, cheaper, stay, auto, explain. Status: implemented; auto is the implicit default.
9. Claude hooks for route context, tool-decision logging, and conservative governance. Status: implemented for `UserPromptSubmit` and `PreToolUse`.
10. Local route and hook logs plus an explain path. Status: implemented with `switchboard explain`.
11. A documented wrapper threat model before production hardening: [Switchboard Wrapper Threat Model](WRAPPER-THREAT-MODEL.md). Status: implemented.

The MVP should defer:

* Cross-vendor routing.
* In-session automatic model switching.
* `deep reasoning` as a standalone user-facing target unless Claude exposes a meaningful distinction.
* Learned routing.
* Rich UI.
* Broad tool permission automation.
* Automatic context packaging.
* Full gateway execution as the primary product surface.
* Fully interactive Claude shell parity unless the prompt-driven wrapper proves insufficient.
* Publishing `@model-switchboard/router` as a separate package.

## 9. Conceptual Routing Model

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

## 10. UX Direction

The default verified command shape should be simple:

```bash
switchboard "Implement the plan."
```

A no-prompt interactive command may be added after validation:

```bash
switchboard
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

## 11. MVP Acceptance Criteria

The MVP is acceptable when:

1. A user can start or resume a routed Claude turn through `switchboard "prompt"`.
2. Switchboard routes before execution to the selected Claude model/effort.
3. The route explanation is visible and compact.
4. The user can override routing at a coarse label level.
5. Session continuity is good enough for normal prompt-driven multi-turn coding work.
6. The first Claude turn uses `--session-id` and subsequent routed turns use `--resume <session-id>`.
7. Route context is persisted before Claude launch.
8. Hook evidence correlates with wrapper route decisions.
9. Logs distinguish user input, Switchboard context, route decisions, model/effort selection, Claude session identity, and tool decisions.
10. Failure modes are clear and fail closed where routing, resume, hook setup, or route-context correlation cannot be trusted.

## 12. Relationship To Other Docs

[PoC](archive/POC.md) describes the original risk-reduction plan.

[PoC Outcome Analysis](archive/POC-OUTCOME-ANALYSIS.md) is the current source of truth for what the first PoC proved and how the product direction changed, including the PoC 2 outcome summary with verified assumptions and MVP implications. [PoC Implementation Notes](archive/POC-IMPLEMENTATION.md) contains the executable PoC 2 evidence.

[Architecture and Design Document](PRD.md) remains broader product context. It should not be treated as MVP scope unless this PRD explicitly includes the feature.

[Switchboard MVP Refactor Plan](archive/SWITCHBOARD-MVP-REFACTOR.md) captures the proposed cleanup to move product code and runtime paths out of the PoC structure.
