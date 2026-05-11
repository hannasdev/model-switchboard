## Unreleased

### 2025-01-02 — Complete Milestone 4: Explainability and Outcome Attribution Foundation

- What changed: Added contract-backed event normalization (RoutingLogEvent schema), attribution store with outcome tracking, decision reasoning reconstruction in explain output, and replay functions for offline policy evaluation.
- Why it matters: Establishes stable observability and policy-evaluation infrastructure so Milestone 5 (second-surface proof) can exercise the router boundary without duplicating explainability work. Enables users to test policy changes against recorded evidence without live Claude runs.
- Who is affected: Switchboard maintainers, policy researchers, and future non-Claude integrations.
- Action needed: None. Review `docs/REPLAY-GUIDE.md` for offline policy evaluation workflow.
- Features:
  - Enhanced `switchboard explain` output includes "Decision Reasoning" section with constraint evaluation, continuity cost, confidence, and selected-target rationale.
  - New `docs/REPLAY-GUIDE.md` guide documents policy testing workflow.
  - New outcome taxonomy enums (EXECUTION_STATUS, ERROR_SIGNAL, SWITCHING_REASON) in `src/router/outcome-constants.js`.
  - New attribution store (`src/switchboard/attribution_store.js`) provides queryable outcome tracking by session, decision ID, or error signal.
  - New replay functions (loadSessionEvidence, replayRoutingDecision, evaluatePolicyOnEvidence) support offline decision evaluation.
  - Backward compatible: all new fields coexist with legacy evidence shape.
- Tests: 80/80 passing (73 original + 7 new attribution tests, 0 regressions).
- PR: https://github.com/hannasdev/model-switchboard/pull/19

### 2026-05-11 — Close Milestone 3 with contract-backed Claude workflow evidence

- What changed: Refit the Claude workflow so route-context persistence and explain output now carry contract-backed router decision, session state, and context-package evidence while separating router and Claude execution data.
- Why it matters: Completes the Milestone 3 control-plane boundary by making Claude a cleaner consumer of router outputs and by preserving stable fields for explain, replay, and hook correlation.
- Who is affected: Switchboard maintainers and contributors working on explainability, replay, and future non-Claude integrations.
- Action needed: None.
- PR: https://github.com/hannasdev/model-switchboard/pull/18

### 2026-05-11 — Close Milestone 2 with explicit session-controller boundary

- What changed: Extracted deterministic session mode-transition ownership into a dedicated controller module, wired router mode resolution through that boundary, and added focused transition tests while preserving existing routing behavior.
- Why it matters: Completes Milestone 2 policy/controller acceptance criteria and reduces coupling before Milestone 3 Claude-workflow boundary refit.
- Who is affected: Switchboard maintainers and contributors working on router-policy evolution.
- Action needed: None.
- PR: https://github.com/hannasdev/model-switchboard/pull/17

### 2026-05-10 — Add deterministic escalation policy and escalation evidence in explain output

- What changed: Added explicit escalation policy handling for low-confidence turns, user corrections, repeated failures, and high-risk implementation; propagated escalation fields into route evidence and human explain output.
- Why it matters: Makes routing behavior less implicit and easier to audit by showing why a stronger target was selected.
- Who is affected: Switchboard users and maintainers reviewing route decisions.
- Action needed: None.
- PR: https://github.com/hannasdev/model-switchboard/pull/16

### 2026-05-10 — Harden CI security defaults and supply-chain hygiene

- What changed: Added a security policy and CODEOWNERS, introduced Dependabot updates, tightened GitHub Actions permissions, and pinned core GitHub Actions to immutable SHAs.
- Why it matters: Reduces CI token exposure and supply-chain drift while improving OpenSSF Scorecard readiness.
- Who is affected: Repository maintainers and reviewers.
- Action needed: Configure branch rules as desired (for example, require Code Owner review only if at least one non-author reviewer is available).
- PR: https://github.com/hannasdev/model-switchboard/pull/6
