# Codex CLI Feasibility Spike Scope

## Status

Status: active spike

Decision record: `DEC-2026-05-13-codex-cli-feasibility-spike` in [../decision-log.md](../decision-log.md).

## Purpose

Determine whether Codex CLI can support Switchboard's core product promise better than the current Claude Code path:

```text
Switchboard chooses the right execution target before a turn,
preserves continuity when switching is worth it,
and reduces the user's model-selection overhead.
```

This spike is not a product build. It is a bounded feasibility check.

## Product Question

Can Codex CLI provide a supported route-authority boundary where Switchboard can choose a model or execution target per turn while preserving enough session continuity to feel natural for software-delivery work?

## What We Need To Verify

1. **Route authority**
   - Can Switchboard pass a route-selected model/profile into Codex CLI using supported CLI options?
   - Does this work for both a new turn and a resumed session?

2. **Continuity**
   - Can a second routed Codex CLI turn resume the prior session after the first turn?
   - Does continuity remain usable when the second turn uses a different route-selected model?

3. **Evidence**
   - Can the probe capture durable evidence that the selected model/profile changed between turns?
   - Can the probe capture durable evidence that the second turn resumed the expected session?
   - Is the evidence inspectable without reading raw implementation details?

4. **User friction**
   - Does the resulting workflow materially reduce model-selection overhead compared with manual Codex model choice?
   - Does it avoid the Claude-style pattern of repeatedly exiting and re-entering an interactive session for each routed turn?

5. **Boundary fit**
   - Does the integration consume router contracts and target metadata rather than Codex-specific shortcuts?
   - Does the result validate a reusable router boundary rather than a one-off Codex script?

## Success Criteria

The spike is successful only if all required criteria are met:

1. A two-turn live probe can run through Codex CLI with two different Switchboard-selected models.
2. The second turn resumes the first turn's Codex session through a supported CLI mechanism.
3. The probe records both selected target IDs and resolved Codex models.
4. The probe records enough session evidence to show that continuity was preserved.
5. The workflow requires no manual model selection by the user after the prompt is provided.
6. The implementation remains a spike/probe and does not replace the Claude MVP path.

## Partial Success

The spike is partial, but still useful, if Codex CLI supports route-selected models only at `exec` or `resume` boundaries.

That outcome would mean Codex CLI may support a non-interactive or wrapper-style Switchboard workflow, but it does not prove automatic switching inside a running interactive Codex TUI.

## Failure Criteria

The spike should be considered failed or blocked if any of the following are true:

1. Codex CLI does not expose a supported model/profile option for resumed turns.
2. Resumed turns cannot preserve usable session continuity.
3. Route-selected model changes are accepted syntactically but cannot be verified from durable evidence.
4. The only viable path requires private, unsupported, or brittle Codex internals.
5. The resulting workflow has the same or worse cognitive overhead as manual model selection.

## Explicit Non-Goals

This spike must not attempt to:

1. Build a full Codex workflow product.
2. Replace the Claude Code MVP.
3. Implement automatic switching inside a running Codex TUI unless Codex exposes a supported mechanism.
4. Build a provider gateway or proxy.
5. Add cross-vendor routing beyond the Codex CLI surface.
6. Tune routing policy or target taxonomy.
7. Add persistent production state beyond probe evidence.
8. Make public product claims before live evidence is collected.

## Probe Plan

### Phase 1: Command-Surface Probe

Status: implemented.

Use [../../scripts/codex-cli-feasibility-probe.js](../../scripts/codex-cli-feasibility-probe.js) to inspect local Codex CLI help output and produce a capability report.

Expected output:

- `status: partial` when `codex exec --model` and `codex exec resume --last --model` are available.
- `authoritativeInsideRunningSession: false` unless a supported in-session mechanism is discovered.
- Two planned routed turns with different selected targets and models.

### Phase 2: Live Resume Probe

Status: next.

Run two real Codex CLI turns:

1. First turn: route an implementation/debugging prompt to a strong coding target and execute with `codex exec --model <model> --json`.
2. Second turn: route a summary/acknowledgement prompt to a cheap/fast target and execute with `codex exec resume --last --model <model> --json`.
3. Capture JSON/session evidence.
4. Evaluate model change, session continuity, and user friction against the success criteria above.

### Phase 3: Product Decision

Classify the result as one of:

- `verified`: Codex CLI supports route-selected resumed turns with usable continuity and inspectable evidence.
- `partial`: Codex CLI supports route-selected command boundaries but not a low-friction interactive workflow.
- `blocked`: Codex CLI cannot support route authority with continuity through supported mechanisms.

## Stop Conditions

Stop the spike when one of these is true:

1. The success criteria are met and documented.
2. A failure criterion is met and documented.
3. The next step would require building production workflow infrastructure instead of collecting feasibility evidence.
4. The next step would require relying on unsupported Codex internals.

## Deliverables

The spike should produce:

1. A command-surface capability report.
2. A live two-turn resume probe result, if feasible.
3. A short decision-log update classifying the result as `verified`, `partial`, or `blocked`.
4. A recommendation for whether Codex CLI should remain a serious candidate for the next product surface.
