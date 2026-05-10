# PoC Outcome Analysis

## Executive Summary

The PoC work supports proceeding to an MVP, but the MVP scope should be narrower than the original generic vendor-scoped router. The first product slice should be a Claude Code integration built from two pieces:

1. A Switchboard wrapper routes before Claude starts or resumes a turn and passes explicit Claude CLI model/effort flags.
2. Claude Code hooks provide prompt visibility, route-context injection, tool-decision logging, and conservative governance inside Claude's execution flow.

This is good news because it avoids brittle UI automation and proves useful control inside a vendor-owned client. It also means the MVP must treat the wrapper as a security-sensitive trust boundary, not merely a convenience script.

PoC 2 materially changed the risk picture. The non-interactive Claude CLI path has verified routed multi-turn continuity with a stable Claude session id, and live hook events can be correlated with wrapper route metadata. The remaining MVP risk is productization, UX, and safety, not whether the basic wrapper/hook architecture can work.

The resulting MVP should start with prompt-driven routed turns:

```bash
switchboard "Implement the plan."
```

A no-prompt interactive `switchboard` mode can follow after validation, but it should not block the initial MVP.

## What The PoC Proved

### Local Router Core

The local router core is viable for a first product slice:

* Deterministic classification and routing works against the fixture set.
* Target metadata is sufficient for `quick`, `balanced`, and `best coder`.
* Route explanations are compact enough to be user-facing.
* Capability misses can be refused deterministically.
* Local decision logging is straightforward.

`deep reasoning` remains intentionally out of scope as a standalone routed target until a selected vendor path exposes a meaningful distinction from planning/balanced or coding targets.

### Router-Owned Gateway Path

The router-owned gateway path is feasible:

* The gateway receives request envelopes before adapter dispatch.
* Target selection affects adapter/profile dispatch.
* Routed `best coder` turns can execute scoped safe file-read, file-edit, and test-command actions.
* File-backed thread state proves repeated-turn continuity in local orchestration.

This path is useful as a controlled execution model, but it is not necessarily the best first product UX if users want to keep working in an existing coding client.

### Claude Code Hook Path

Claude Code is now the most promising vendor-owned client path.

Confirmed:

* `UserPromptSubmit` sees the user prompt before Claude processes it.
* The hook can inject route context into Claude Code.
* `PreToolUse` sees tool calls before execution.
* The hook can allow or deny tool calls before execution.
* Hook events include useful session evidence such as `cwd`, `session_id`, and transcript path.

Important constraint:

* `UserPromptSubmit` can advise, add context, or block, but it does not appear to provide a supported way to change the current turn's model or effort inside an already-running Claude session.

### Claude CLI Launcher Path

Claude CLI launch flags prove actual target influence before execution:

* `quick` can route to `claude --model haiku --effort low`.
* `best coder` can route to `claude --model sonnet --effort high`.
* Live execution confirmed both the cheap/fast path and the escalation path.
* The escalation model probe returned `modelUsage` for `claude-sonnet-4-6`.

This confirms that a wrapper can make a real pre-execution model/effort decision without scraping or automating the terminal UI.

### PoC 2 Switchboard Path

PoC 2 verified the narrower Claude workflow path:

* Planned routed turns can share one Claude session id while changing route labels and model/effort flags.
* The first non-interactive turn must start Claude with `--session-id`; later turns must use `--resume <session-id>`.
* Live run `live-poc2-007` verified that both turns executed, used the same Claude session id, changed route from `best coder` to `balanced`, advanced turn count, and recovered the first-turn probe phrase.
* Route metadata written before launch can be matched by live `UserPromptSubmit` and `PreToolUse` hook events.
* Live hook run `live-poc2-hooks-001` verified `UserPromptSubmit` correlation for both routed turns.
* Live tool-hook run `live-poc2-toolhook-001` verified `PreToolUse` correlation and logged an allowed `Read` tool decision.
* Hook correlation can produce route-aware injected context and route-aware tool-decision logs.

This moves Claude continuity from an unresolved blocker to an MVP implementation requirement. The product should encode the verified launch/resume semantics directly instead of treating resume behavior as an open design choice.

### Verified Assumptions

The latest evidence verifies these assumptions strongly enough for MVP planning:

* Wrapper routing authority exists at the launch/resume boundary.
* Claude model/effort can be selected before execution by the wrapper.
* Non-interactive routed continuity can work across at least two turns.
* Route context can be written before launch and correlated by hooks.
* The deterministic policy still maps cleanly to `quick`, `balanced`, and `best coder`.
* The router/workflow code boundary is credible enough to continue, even though package extraction is deferred.

### Falsified Or Constrained Assumptions

The latest evidence also narrows the original product idea:

* Hooks should not be treated as a supported mechanism for changing the active turn's model or effort.
* Reusing `--session-id` for a later non-interactive turn is wrong; later turns must use `--resume <session-id>`.
* A hook-only MVP is not enough if the goal is automatic target routing.
* A router-owned gateway is viable, but it is not the right primary MVP UX for users who want Claude Code continuity.
* `deep reasoning` still does not deserve a standalone user-facing MVP target.

### Remaining Risks

The unresolved risks are now narrower:

* The product surface is still a PoC harness, not a polished `switchboard` command.
* Interactive no-prompt Claude UX is not validated.
* Production tool-governance policy is not hardened.
* Failure behavior around auth, hook setup, resume, and route-context correlation needs to be explicit and fail closed.
* Live runs depend on Claude CLI authentication and local environment state.
* Router extraction into `@model-switchboard/router` is still future productization work.

## What The PoC Did Not Prove

### In-Session Model Switching

The PoC did not prove automatic model/effort switching from inside an active Claude Code turn, and the current evidence suggests this should be treated as out of scope unless Claude exposes a supported mechanism.

Hooks can participate in the turn, but they should be treated as advisory and governance controls. Actual model selection belongs at the launch/resume boundary unless Claude adds a supported hook output for model switching.

### Seamless User Experience

The PoC used explicit commands such as `npm run poc:claude-cli-live`, `npm run poc:switchboard-continuity-live`, and `npm run poc:switchboard-turn -- --live true`. That is acceptable for validation, but not acceptable as the final user experience.

If the product requires users to remember routing commands or choose between wrapper modes manually, it will not meaningfully remove model-choice fatigue.

### Safe Wrapper Trust Boundary

The PoC proved that the wrapper can influence execution. That also means the wrapper can create security risk.

The MVP must not ship a privileged prompt-rewriting layer without clear boundaries, auditability, and fail-closed behavior.

### Continuity Across Routed Claude Turns

The first PoC proved local file-backed continuity in the router-owned gateway. PoC 2 has now proven a narrow Claude wrapper continuity model across non-interactive routed turns.

The remaining risk is the end-user workflow shape. A prompt-driven wrapper has evidence; a fully interactive Claude replacement still needs validation.

### Production Logging And Explainability

The PoC has enough evidence for local route and hook logs, but it has not yet defined the stable user-facing explain path.

The MVP needs a durable way to answer:

* What prompt did Switchboard route?
* Which route label and Claude flags were selected?
* Which Claude session id was used?
* Which Switchboard context was injected?
* Which hook events matched the wrapper route?
* Which tool decisions were logged or denied?

## Product Interpretation

The MVP should not be framed as "a router inside Claude that magically switches models mid-session." The confirmed architecture is:

```text
User
  -> switchboard wrapper
  -> router policy
  -> Claude CLI launch/resume with selected model/effort
  -> Claude Code hooks for route context and tool governance
  -> local route/tool logs
```

This is still a credible MVP if the wrapper feels seamless.

The product promise should become:

```text
Use Claude Code normally through Switchboard. Switchboard chooses the model/effort before the turn, explains the choice, and preserves Claude's safety posture while adding route-aware tool governance.
```

There are also two separable product layers:

1. A reusable routing engine that chooses among model targets.
2. A workflow integration that puts routing on the pre-execution path for a specific user surface.

The Claude Code wrapper/hooks path is the first applied workflow product, not proof that routing only matters for software development. The router core should remain extractable as `@model-switchboard/router`, while Claude-specific launch, resume, hook, and continuity behavior should live in a workflow package such as `@model-switchboard/claude-code`.

The practical implication is that MVP implementation should productize the Claude workflow gap without tangling generic routing policy into Claude wrapper mechanics. Target registry, classification, policy, capability filtering, route explanation, and refusal logic should stay router-shaped.

## MVP Scope Implications

### Recommended MVP Scope

Build a Claude Code-scoped MVP with:

1. A `switchboard` command that wraps Claude Code.
2. Prompt-driven routed turns as the first supported workflow.
3. A persistent local session record.
4. Pre-launch and pre-resume routing to Claude model/effort flags.
5. Verified Claude continuity semantics: first turn uses `--session-id`, later turns use `--resume <session-id>`.
6. Route-context persistence before launch so hooks can correlate wrapper and Claude events.
7. Claude Code hooks for route explanation and tool policy.
8. Simple override controls.
9. Route and tool-decision logs plus an explain path.
10. Explicit fail-closed behavior for untrusted route/hook state.
11. A small security policy for wrapper behavior.

### Defer From MVP

Defer:

* Cross-vendor routing.
* In-session automatic model switching.
* General-purpose gateway execution as the primary UX.
* Learned routing.
* Automatic context packaging.
* Broad tool permission automation.
* Rich UI.
* Fully interactive Claude shell parity unless prompt-driven routed turns prove insufficient.
* Publishing the router as a separate package.
* Advanced outcome scoring or learned policy updates from logs.

### Reframe Advisory Mode

Advisory mode is still useful, but only for hook-only operation inside an already-running Claude session.

For the MVP, advisory mode should be secondary. The primary route should be wrapper-mediated execution because it can actually choose model/effort before execution.

## Security Implications

The wrapper becomes part of the execution trust boundary.

Minimum MVP security requirements:

1. No hidden prompt mutation beyond a deterministic, labeled Switchboard context block.
2. No automatic permission escalation based only on route label.
3. Tool permission policy must fail closed.
4. User/repo/model text must not be able to modify Switchboard policy.
5. Logs must distinguish user prompt, Switchboard-generated context, route decisions, and tool decisions.
6. Dangerous shell commands must be denied or require explicit user confirmation.
7. The wrapper must preserve Claude Code's default permission model unless the user explicitly configures stricter policy.
8. The wrapper should make it obvious when it is active.
9. If route context cannot be written before launch, the wrapper should not launch as if routing is active.
10. If hook events cannot be correlated to wrapper route context, tool governance should fail closed or degrade explicitly to advisory logging.

Security product principle:

```text
Routing may choose model/effort automatically. Execution authority must not expand automatically.
```

## UX Implications

The MVP must feel like one normal tool, not a bundle of PoC commands.

Target user experience for the verified MVP wedge:

```bash
switchboard "Implement the plan."
```

A no-prompt interactive command can follow after validation:

```bash
switchboard
```

Possible later affordance:

```bash
alias claude="switchboard"
```

The route explanation should be short and skippable:

```text
Switchboard: best coder · repo edits · higher effort
```

Detailed route state belongs in logs or an explicit explain command.

## Recommended Next Experiments

### 1. Productized CLI Wrapper

Replace PoC npm commands with a first-class local command:

```bash
switchboard "prompt"
```

The prototype should hide PoC wiring while preserving auditable output and logs.

### 2. Explain And Audit Path

Add a stable way to inspect the most recent routed turn:

```bash
switchboard explain
```

It should show the route label, selected Claude flags, session id, correlation state, hook events, and any tool decisions without dumping raw transcripts by default.

### 3. Fail-Closed Harness

Exercise failure cases before widening authority:

* Missing Claude auth.
* Hook setup missing or unreadable.
* Route context write failure.
* Resume failure.
* Hook event without matching wrapper context.
* Tool event with no trusted route context.

### 4. Interactive UX Probe

Validate whether a no-prompt `switchboard` mode can feel like normal Claude Code usage without weakening route explainability or resume semantics.

### 5. Wrapper Threat Model

Write a short threat model before expanding the wrapper:

* What can the wrapper read?
* What can the wrapper write?
* What can it inject?
* What can repo content influence?
* What is logged?
* What requires explicit user approval?

## Decision

Proceed to the Claude Code-scoped MVP, but keep it narrow:

* Vendor/client: Claude Code.
* Product surface: prompt-driven local wrapper plus Claude hooks.
* Routing authority: model/effort selection at launch/resume boundary.
* In-session authority: explanation, logging, and tool governance.
* Continuity rule: `--session-id` for the first turn, `--resume <session-id>` for later turns.
* Correlation rule: write route context before launching Claude.
* Security stance: wrapper is trusted infrastructure and must be designed accordingly.

Do not proceed with a hook-only MVP if the goal is automatic target routing. Hook-only mode is advisory and governance-oriented, not a complete model-choice solution.

Do not make full interactive Claude parity a launch requirement. It is valuable, but the prompt-driven wrapper path now has enough evidence to be the MVP wedge.
