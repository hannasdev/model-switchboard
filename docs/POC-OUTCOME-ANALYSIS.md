# PoC Outcome Analysis

## Executive Summary

The PoC supports proceeding to an MVP, but the MVP scope should change from a generic vendor-scoped router to a narrower Claude Code integration slice.

The strongest confirmed path is not an in-session model switch inside Claude Code. It is a split control plane:

1. A wrapper or launcher routes before Claude starts or resumes a turn and passes explicit Claude CLI model/effort flags.
2. Claude Code hooks provide in-client prompt visibility, route explanation, tool governance, and logging.

This is good news because it avoids brittle UI automation and proves useful control inside a vendor-owned client. It also means the MVP must treat the wrapper as a security-sensitive trust boundary, not merely a convenience script.

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

## What The PoC Did Not Prove

### In-Session Model Switching

The PoC did not prove automatic model/effort switching from inside an active Claude Code turn.

Hooks can participate in the turn, but they should be treated as advisory and governance controls. Actual model selection belongs at the launch/resume boundary unless Claude adds a supported hook output for model switching.

### Seamless User Experience

The PoC used explicit commands such as `npm run poc:claude-cli-live`. That is acceptable for validation, but not acceptable as the final user experience.

If the product requires users to remember routing commands or choose between wrapper modes manually, it will not meaningfully remove model-choice fatigue.

### Safe Wrapper Trust Boundary

The PoC proved that the wrapper can influence execution. That also means the wrapper can create security risk.

The MVP must not ship a privileged prompt-rewriting layer without clear boundaries, auditability, and fail-closed behavior.

### Continuity Across Routed Claude Turns

The PoC proved local file-backed continuity in the router-owned gateway. It has not yet proven a satisfying Claude wrapper continuity model across multiple routed turns.

The next risk is whether the wrapper can preserve the user's sense of one ongoing session while routing different turns to different model/effort combinations.

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

The practical implication is that PoC 2 should validate the Claude workflow gap without tangling generic routing policy into Claude wrapper mechanics. Target registry, classification, policy, capability filtering, route explanation, and refusal logic should stay router-shaped.

## MVP Scope Implications

### Recommended MVP Scope

Build a Claude Code-scoped MVP with:

1. A `switchboard` command that wraps Claude Code.
2. A persistent local session record.
3. Pre-launch routing to Claude model/effort flags.
4. Claude Code hooks for route explanation and tool policy.
5. Simple override controls.
6. Route and tool-decision logs.
7. A small security policy for wrapper behavior.

### Defer From MVP

Defer:

* Cross-vendor routing.
* In-session automatic model switching.
* General-purpose gateway execution as the primary UX.
* Learned routing.
* Automatic context packaging.
* Broad tool permission automation.
* Rich UI.

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

Security product principle:

```text
Routing may choose model/effort automatically. Execution authority must not expand automatically.
```

## UX Implications

The MVP must feel like one normal tool, not a bundle of PoC commands.

Target user experience:

```bash
switchboard
```

or:

```bash
switchboard "Implement the plan."
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

### 1. Claude Continuity Probe

Build and test a two-turn wrapper flow:

1. Turn one routes to `best coder` and creates or resumes a Claude session.
2. Turn two routes to `quick` or `balanced`.
3. Verify whether Claude session continuity remains acceptable.
4. Verify whether model/effort can change between turns while preserving useful context.

This is the next highest-risk unknown.

### 2. Wrapper Threat Model

Write a short threat model before expanding the wrapper:

* What can the wrapper read?
* What can the wrapper write?
* What can it inject?
* What can repo content influence?
* What is logged?
* What requires explicit user approval?

### 3. Seamless CLI Prototype

Replace PoC npm commands with a first-class local command:

```bash
switchboard "prompt"
```

The prototype should hide PoC wiring while preserving auditable output and logs.

## Decision

Proceed toward an MVP, but narrow it:

* Vendor/client: Claude Code.
* Product surface: local wrapper plus Claude hooks.
* Routing authority: model/effort selection at launch/resume boundary.
* In-session authority: explanation, logging, and tool governance.
* Security stance: wrapper is trusted infrastructure and must be designed accordingly.

Do not proceed with a hook-only MVP if the goal is automatic target routing. Hook-only mode is advisory and governance-oriented, not a complete model-choice solution.
