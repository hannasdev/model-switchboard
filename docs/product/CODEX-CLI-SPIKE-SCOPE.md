# Codex CLI Feasibility Spike Scope

## Status

Status: app-server in-session probe implemented; supportability decision pending

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

## App-Server Supportability Review

The app-server result is technically promising, but it should not graduate into product direction until these supportability gates are checked off. Treat this as a product/platform risk review, not an implementation backlog.

Status legend:

- `[ ]` Not checked yet.
- `[~]` Partially checked; evidence exists but a material caveat remains.
- `[x]` Checked with durable evidence in this spike.

### Gate 1: Public Surface

Status: `[x]`

Question: Is `codex app-server` an intended external integration surface rather than an internal-only or experimental protocol?

Evidence needed:

- `codex app-server --help` exposes the command and relevant subcommands.
- Generated protocol schemas are available through supported CLI commands.
- Documentation, release notes, schema comments, or maintainer statements describe intended use and stability.

Current evidence:

- Local Codex CLI version checked on 2026-05-13: `codex-cli 0.130.0`.
- `codex app-server --help` exposes `app-server` as an available command with `stdio://`, websocket, unix socket, and `off` listen modes. The command is labeled `[experimental]`.
- `codex app-server generate-ts --help` and `codex app-server generate-json-schema --help` expose schema generation commands. Both are labeled `[experimental]`, and both support an `--experimental` flag to include experimental methods and fields.
- OpenAI's public `openai/codex` repository documents `codex app-server` as the interface Codex uses to power rich interfaces such as the Codex VS Code extension.
- The same README documents JSON-RPC-like app-server protocol semantics, lifecycle, initialization, schema generation, and client identification.
- The README states that generated TypeScript and JSON Schema artifacts are specific to the Codex version used to generate them and match that version.
- The README also distinguishes stable surface from experimental surface. It says stable-only output is the default, while experimental methods and fields require opt-in at schema-generation time or runtime initialization.
- Generated stable TypeScript bindings include the Switchboard-relevant methods and fields:
  - `ClientRequest` includes `thread/start`, `turn/start`, and `thread/read`.
  - `ThreadStartParams` includes `model?: string | null`.
  - `TurnStartParams` includes `model?: string | null` with the comment "Override the model for this turn and subsequent turns."
  - `ThreadReadParams` includes `includeTurns: boolean`.
- Caveat: the command and schema tooling remain labeled experimental, and the README says experimental methods and fields have no backwards-compatible guarantees. This gate therefore passes only for a bounded integration spike, not as a production stability claim.

Pass condition:

- Met for spike purposes. We can point to a public OpenAI repository README, a local CLI command surface, and generated protocol artifacts that make app-server reasonable to depend on for the next feasibility step.

Fail condition:

- The only evidence is private implementation behavior or generated files with no indication that external clients may rely on them.

### Gate 2: Protocol Stability

Status: `[x]`

Question: Are the required methods and fields stable enough to build against without excessive breakage risk?

Evidence needed:

- Required methods: `initialize`, `thread/start`, `turn/start`, `thread/read`.
- Required fields: `InitializeCapabilities.experimentalApi`, `ThreadStartParams.model`, `TurnStartParams.threadId`, `TurnStartParams.input`, `TurnStartParams.model`, `ThreadReadParams.threadId`, `ThreadReadParams.includeTurns`.
- Version/capability marker for the experimental API, or a documented compatibility/deprecation story.
- Snapshot or fixture that records the minimum protocol shape Switchboard depends on.

Current evidence:

- [../../scripts/codex-app-server-protocol-check.js](../../scripts/codex-app-server-protocol-check.js) generates app-server TypeScript bindings with `codex app-server generate-ts --out <tmpdir>` and validates the minimum protocol shape Switchboard depends on.
- The check verifies required client methods in `ClientRequest.ts`: `initialize`, `thread/start`, `turn/start`, and `thread/read`.
- The check verifies required generated fields: `InitializeCapabilities.experimentalApi`, `ThreadStartParams.model`, `TurnStartParams.threadId`, `TurnStartParams.input`, `TurnStartParams.model`, `ThreadReadParams.threadId`, and `ThreadReadParams.includeTurns`.
- [../../test/codex-app-server-protocol-check.test.js](../../test/codex-app-server-protocol-check.test.js) records a fixture for the minimum protocol shape and verifies the checker fails clearly if `TurnStartParams.model` disappears.
- `npm run switchboard:spike:codex-app-server:protocol` returned `status: verified` on 2026-05-13 against freshly generated bindings from local `codex-cli 0.130.0`.
- Caveat: this checks schema shape for the installed Codex CLI version. It does not promise backwards compatibility across future Codex releases; it gives Switchboard a fast failure signal when the app-server protocol changes.

Pass condition:

- Met for spike purposes. The protocol check validates the required shape and fails clearly when required methods or fields change.

Fail condition:

- Required fields are absent, unstable across versions, or only inferable from raw rollout internals.

### Gate 3: User Install And Auth Path

Status: `[x]`

Question: Can a normal Switchboard user run the app-server path without fragile local setup?

Evidence needed:

- Codex CLI version requirement.
- Authentication requirement and failure mode.
- Whether app-server is available in the same Codex CLI users install for normal interactive use.
- Clear diagnostic when Codex is missing, unauthenticated, or too old.

Evidence:

- [../../scripts/codex-app-server-preflight.js](../../scripts/codex-app-server-preflight.js) verifies the local Codex CLI version, checks `codex app-server --help`, checks `codex login status`, starts `codex app-server --listen stdio://`, initializes the experimental app-server protocol, and reads redacted auth/account evidence through `getAuthStatus` and `account/read`.
- [../../test/codex-app-server-preflight.test.js](../../test/codex-app-server-preflight.test.js) covers the normal install path and the actionable failure modes for too-old Codex CLI, missing app-server support, and missing auth.
- `npm run switchboard:spike:codex-app-server:preflight` returned `status: verified` on 2026-05-13 against local `codex-cli 0.130.0`.
- Live preflight evidence: `codex --version` reported `0.130.0`; `codex app-server --help` exposed the experimental app-server command; `codex login status` reported a ChatGPT login; app-server auth returned `authMethod: "chatgpt"` and a redacted ChatGPT account.
- Caveat: this validates the local installed Codex CLI path. The app-server command remains experimental, and the minimum version should stay pinned to the earliest version Switchboard has actually verified.

Pass condition:

- Met for spike purposes. A user can install/login/run a preflight command and get actionable output before Switchboard attempts a routed session.

Fail condition:

- The path depends on developer-only builds, hidden flags, or undocumented local state.

### Gate 4: Process Lifecycle Safety

Status: `[x]`

Question: Can Switchboard safely own a long-running app-server process?

Evidence needed:

- Start/stop behavior.
- Clean shutdown after idle or user exit.
- Behavior after app-server crash.
- Behavior after interrupted turn.
- Handling for malformed JSON, protocol errors, stderr warnings, and child process spawn failure.

Evidence:

- [../../scripts/codex-app-server-lifecycle-probe.js](../../scripts/codex-app-server-lifecycle-probe.js) starts `codex app-server --listen stdio://`, initializes the app-server protocol, verifies an unsupported request returns a bounded protocol error, starts a thread, completes one turn, starts and interrupts a second turn after `turn/started`, captures stderr warning output, ignores malformed JSON lines, and waits for shutdown.
- [../../test/codex-app-server-lifecycle-probe.test.js](../../test/codex-app-server-lifecycle-probe.test.js) covers the lifecycle harness with a fake app-server, including malformed stdout, stderr warnings, protocol errors, interrupted turns, app-server crash, and child process spawn failure.
- `npm run switchboard:spike:codex-app-server:lifecycle` returned `status: verified` on 2026-05-14 against local `codex-cli 0.130.0`.
- Live lifecycle evidence: initialize passed; unsupported request returned a protocol error without killing the server; one turn completed; a second turn was interrupted successfully after waiting for `turn/started`; shutdown returned exit code `0`.
- Caveat: real malformed-output and crash behavior are not induced against the live Codex app-server; those failure modes are covered by deterministic fake-process tests because the real server should not normally emit malformed JSON or crash on demand.

Pass condition:

- Met for spike purposes. A lifecycle probe demonstrates start, two turns, interruption, shutdown, and clear error reporting for protocol, stderr, malformed-output, crash, and spawn-failure paths.

Fail condition:

- A failed or interrupted app-server leaves Switchboard unable to recover without manual cleanup.

### Gate 5: Continuity And Session Semantics

Status: `[x]`

Question: Does the app-server path preserve one continuous session while Switchboard changes the route-selected model?

Evidence needed:

- Two turns complete on the same `threadId` / `sessionId`.
- `thread/read` can inspect the resulting thread and report both turns.
- No `codex exec resume` boundary is required.

Current evidence:

- `npm run switchboard:spike:codex-app-server` returned `status: verified` on 2026-05-13.
- Turn 1 selected `openai-coder` / `codex-best-coder` / `gpt-5.5`.
- Turn 2 selected `openai-quick` / `codex-fast` / `gpt-5.4-mini`.
- Both turns completed on `019e21f7-0b2e-7730-9cbd-af5e5536ddbf`.
- `thread/read` returned `turnCount: 2`.

Pass condition:

- Already met for the current local Codex CLI version.

Fail condition:

- Future live probes cannot preserve same-thread continuity when `turn/start.model` changes.

### Gate 6: Model Evidence

Status: `[~]`

Question: Can we prove the second turn actually used the route-selected model, not merely that Codex accepted a model override request?

Evidence needed:

- Per-turn model/provider metadata from `turn/start`, `turn/completed`, `thread/read`, `model/rerouted`, logs, or another supportable app-server notification.
- Clear distinction between requested model, accepted model, rerouted model, and unavailable telemetry.

Current evidence:

- The app-server accepted `turn/start` with `model: "gpt-5.4-mini"` on the second turn and completed the turn on the same thread.
- [../../scripts/codex-app-server-switch-probe.js](../../scripts/codex-app-server-switch-probe.js) now records model evidence separately from route requests: requested models, turn payload model fields, `thread/read` model fields, raw response item model fields, `model/rerouted`, and `model/verification`.
- `npm run switchboard:spike:codex-app-server` returned `status: verified` on 2026-05-13 with two requested models on one thread: `gpt-5.5` then `gpt-5.4-mini`.
- The same live run reported `backendModelTelemetryObserved: false`.
- `turn/start` responses and `turn/completed` notifications contained no effective model field.
- `thread/read` returned both turns but no per-turn or item-level model field for the executed model.
- No `rawResponseItem/completed`, `model/rerouted`, or `model/verification` model telemetry was emitted in the live run.
- Caveat: Gate 6 remains partial. We can prove requested model override plus same-thread completion, but not provider-side effective model attestation.

Pass condition:

- We can capture per-turn selected or effective model metadata, or explicitly decide that accepted override plus same-thread completion is enough for the product risk tolerance.

Fail condition:

- We cannot capture backend model telemetry and the product requires provider-side attestation before making claims.

### Gate 7: Product Fit

Status: `[~]`

Question: Does the app-server path reduce cognitive overhead enough to justify a Codex product surface beyond Claude parity?

Evidence needed:

- User can stay in one Switchboard-controlled session loop.
- Switchboard routes before each prompt without manual model selection.
- The workflow avoids repeated exit/resume commands.
- UX implications are documented, including that this is not the stock Codex interactive TUI unless we build a wrapper surface.

Current evidence:

- The app-server probe avoids `exec resume` and manual model selection.
- Caveat: turning this into a usable product likely means Switchboard owns the session UI or loop.

Pass condition:

- Product accepts a Switchboard-controlled Codex session surface as the differentiated workflow.

Fail condition:

- Product requires hot-swapping inside the stock Codex TUI specifically, and app-server cannot provide that.

### Supportability Decision Rule

Codex app-server can graduate from promising spike to serious product-surface candidate only if:

1. Gates 1, 2, 3, 4, 5, and 7 pass.
2. Gate 6 either passes or is explicitly accepted as a known risk.
3. No gate requires private Codex internals or raw rollout-file parsing as the primary mechanism.

If Gate 7 fails because the required user experience must be the stock Codex TUI, classify Codex as `partial` despite the app-server evidence.

### Next Check Order

Work through the gates in this order:

1. Gate 1: Public Surface.
2. Gate 2: Protocol Stability.
3. Gate 6: Model Evidence.
4. Gate 3: User Install And Auth Path.
5. Gate 4: Process Lifecycle Safety.
6. Gate 7: Product Fit.

Gate 5 is already checked for the current local Codex CLI version.

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

Status: repeatable app-server probe implemented; supportability and product-surface fit pending.

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

Repeatable probe:

- [../../scripts/codex-app-server-switch-probe.js](../../scripts/codex-app-server-switch-probe.js) starts `codex app-server --listen stdio://`, initializes the experimental protocol, starts one thread with the first routed model, and sends a second `turn/start` on the same thread with the second routed model.
- The probe reports selected target IDs, resolved Codex models, thread/session IDs, completed turn IDs, agent-message evidence, notification counts, and any observed `model/rerouted` notifications.
- The probe intentionally reports the second turn as an accepted model override on the same app-server thread. It does not overclaim provider-side backend telemetry unless Codex emits explicit model telemetry.

Repeatable live result on 2026-05-13:

- `npm run switchboard:spike:codex-app-server` returned `status: verified`.
- First turn selected `openai-coder` / `codex-best-coder` / `gpt-5.5`.
- Second turn selected `openai-quick` / `codex-fast` / `gpt-5.4-mini`.
- Both turns completed on the same `threadId` / `sessionId`: `019e21f7-0b2e-7730-9cbd-af5e5536ddbf`.
- `thread/read` returned `turnCount: 2`.
- No `model/rerouted` telemetry was emitted, so the durable evidence remains accepted turn-level model override plus same-thread completion rather than provider-side backend model attestation.

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
