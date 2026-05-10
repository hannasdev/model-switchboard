# Switchboard Wrapper Threat Model

## Scope

This document covers the Claude Code-scoped MVP wrapper:

```text
switchboard "prompt"
  -> route before Claude launch/resume
  -> write Switchboard route context
  -> launch or resume Claude with selected model/effort
  -> Claude hooks correlate tool events with wrapper route context
```

It does not cover cross-vendor routing, learned routing, enterprise policy, data-loss prevention, or a fully interactive Claude replacement.

## Assets

The wrapper must protect:

* User prompt integrity.
* Route policy integrity.
* Claude session identity.
* Route-context store integrity.
* Hook-event correlation integrity.
* Claude Code's default permission posture.
* Local route, hook, and execution logs.

## Trust Boundaries

Trusted:

* Switchboard source code in this repository.
* Local target registry and deterministic routing policy.
* The local route-context store written by Switchboard before Claude launch.

Conditionally trusted:

* Claude CLI execution, once launched with explicit model/effort/session flags.
* Claude hook inputs, only after correlation with the expected Claude session id.
* Local logs, as audit evidence but not as authority for future permission decisions.

Untrusted:

* User prompt text.
* Repository content.
* Model output.
* Tool arguments produced by Claude.
* Hook events that do not correlate with Switchboard route context.

## Threats And Controls

| Threat | Control |
| --- | --- |
| Prompt or repo content tries to alter routing policy. | Policy is code/config-driven; user/repo/model text is not interpreted as Switchboard policy. |
| Wrapper silently mutates the user prompt. | Only deterministic labeled Switchboard context may be injected. Logs distinguish user prompt from wrapper context. |
| Claude launches without auditable route context. | Route context must be written before launch; pre-launch failures stop before Claude execution. |
| Later turns reuse the wrong session semantics. | First turn uses `--session-id`; later routed turns use `--resume <session-id>`. |
| Hook event cannot be tied to wrapper routing evidence. | `PreToolUse` fails closed when route context is missing or unmatched. |
| Route label expands execution authority. | Routing may select model/effort, but it must not automatically escalate tool permissions. |
| Destructive shell command is proposed. | `PreToolUse` denies destructive or privileged shell commands in the MVP policy. |
| Logs expose more than needed for normal explain. | `switchboard explain` summarizes route and hook evidence without dumping raw transcripts by default. |

## MVP Rules

1. Switchboard may choose Claude model/effort automatically.
2. Switchboard must not expand Claude execution authority automatically.
3. Switchboard must write route context before launching Claude.
4. If route context cannot be written, do not launch Claude as a routed turn.
5. If a `PreToolUse` event cannot be correlated, deny the tool call.
6. If a dangerous shell command is observed, deny the tool call.
7. Keep user prompt, wrapper context, route decision, Claude flags, session id, hook events, and tool decisions separately logged.
8. Prefer explicit failure over silent fallback when wrapper or hook trust cannot be established.

## Deferred

* Organization policy integration.
* Secret scanning and DLP.
* Rich permission automation.
* Cross-vendor safety policy.
* Learned routing from outcome logs.
* Full interactive Claude shell parity.
