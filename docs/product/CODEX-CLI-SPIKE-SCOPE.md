# Codex CLI Feasibility Spike Scope

## Status

Status: app-server in-session evidence observed; supportability decision pending

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

Can Codex CLI provide a supported in-session route-authority boundary where Switchboard can choose a model or execution target during an ongoing user session, preserving continuity without forcing a command-boundary workflow?

## What We Need To Verify

1. **Route authority**
   - Can Switchboard pass a route-selected model/profile into Codex CLI using supported CLI options?
   - Does this work for both a new turn and a resumed session?
   - Does Codex CLI expose any supported mechanism to change the model inside an already-running interactive session?

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
   - Does it go beyond Claude parity by allowing the user to remain inside the same interactive session while Switchboard changes the route?

5. **Boundary fit**
   - Does the integration consume router contracts and target metadata rather than Codex-specific shortcuts?
   - Does the result validate a reusable router boundary rather than a one-off Codex script?

## Success Criteria

The spike is successful only if all required criteria are met:

1. A supported Codex CLI mechanism allows Switchboard to change the selected model/profile inside an already-running interactive session.
2. A two-turn live probe can exercise that mechanism with two different Switchboard-selected models without requiring the user to exit or resume a separate command.
3. The probe records both selected target IDs and resolved Codex models.
4. The probe records enough session evidence to show that continuity was preserved.
5. The workflow requires no manual model selection by the user after the prompt is provided.
6. The implementation remains a spike/probe and does not replace the Claude MVP path.

## Partial Success

The spike is partial, but still useful, if Codex CLI supports route-selected models only at `exec` or `resume` boundaries.

That outcome means Codex CLI may support a non-interactive or wrapper-style Switchboard workflow, but it does not go beyond Claude parity for the primary product differentiator: automatic model switching inside a running interactive session.

## Failure Criteria

The spike should be considered failed or blocked if any of the following are true:

1. Codex CLI does not expose a supported model/profile option for resumed turns.
2. Resumed turns cannot preserve usable session continuity.
3. Route-selected model changes are accepted syntactically but cannot be verified from durable evidence.
4. The only viable path requires private, unsupported, or brittle Codex internals.
5. The resulting workflow has the same or worse cognitive overhead as manual model selection.
6. Codex CLI cannot support in-session model changes beyond the same command-boundary pattern already available through Claude-style launch/resume flows.

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

Status: verified as partial/parity evidence for `exec`/`resume` boundary continuity.

Run two real Codex CLI turns:

1. First turn: route an implementation/debugging prompt to a strong coding target and execute with `codex exec --model <model> --json`.
2. Second turn: route a summary/acknowledgement prompt to a cheap/fast target and execute with `codex exec resume --last --model <model> --json`.
3. Capture JSON/session evidence.
4. Evaluate model change, session continuity, and user friction against the success criteria above.

Observed 2026-05-13:

- First routed turn selected `openai-coder` / `codex-best-coder` / `gpt-5.5`.
- Second routed turn selected `openai-quick` / `codex-fast` / `gpt-5.4-mini`.
- `codex exec resume --last --model gpt-5.4-mini --json` completed successfully.
- Both turns reported shared thread/session evidence: `019e21ad-1f30-72d0-bec0-08d275284eaf`.
- This verifies route-selected model changes at Codex CLI `exec`/`resume` boundaries, not model changes inside an already-running interactive Codex TUI.
- Because in-session switching is the intended differentiator beyond Claude, this evidence is partial/parity evidence rather than a success condition for changing product direction.

### Phase 3: In-Session Switch Probe

Status: app-server protocol smoke test passed; supportability and product-surface fit pending.

Investigate whether Codex CLI exposes a supported hook, command, control protocol, config reload behavior, or interactive-session API that can change the active model after an interactive session has started.

Required evidence:

1. The mechanism is documented, exposed in help output, or otherwise supportable without private internals.
2. A running interactive session accepts a route-selected model/profile change after the first user turn.
3. A second user turn runs under the new model while preserving the same interactive session continuity.
4. The user does not need to manually choose the model, exit the session, or start a separate `exec resume` command.
5. The probe records durable evidence for the session identity and model change.

Observed 2026-05-13:

- Generated Codex app-server protocol bindings from `codex app-server generate-ts`.
- `turn/start` exposes `model?: string | null` with generated documentation: "Override the model for this turn and subsequent turns."
- A live app-server stdio smoke test started one thread with `gpt-5.5`, ran a first turn, then ran a second `turn/start` on the same `threadId` with `model: "gpt-5.4-mini"`.
- Both turns completed on the same `threadId` / `sessionId`: `019e21ec-89f0-7a03-b5f6-f8590818eb1b`.
- This did not require `codex exec resume`, manual model selection, or starting a separate command-boundary workflow.
- Caveat: the evidence is from the experimental Codex app-server protocol, not from a documented interactive TUI hook. The next decision is whether Switchboard can treat the app-server protocol as a supportable product surface.

### Phase 4: Product Decision

Classify the result as one of:

- `verified`: Codex CLI supports supported in-session route-selected model changes with usable continuity and inspectable evidence.
- `partial`: Codex CLI supports route-selected command boundaries but does not go beyond Claude parity for interactive use.
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
