## Unreleased

### 2026-05-10 — Add deterministic escalation policy and escalation evidence in explain output

- What changed: Added explicit escalation policy handling for low-confidence turns, user corrections, repeated failures, and high-risk implementation; propagated escalation fields into route evidence and human explain output.
- Why it matters: Makes routing behavior less implicit and easier to audit by showing why a stronger target was selected.
- Who is affected: Switchboard users and maintainers reviewing route decisions.
- Action needed: None.
- PR: pending

### 2026-05-10 — Harden CI security defaults and supply-chain hygiene

- What changed: Added a security policy and CODEOWNERS, introduced Dependabot updates, tightened GitHub Actions permissions, and pinned core GitHub Actions to immutable SHAs.
- Why it matters: Reduces CI token exposure and supply-chain drift while improving OpenSSF Scorecard readiness.
- Who is affected: Repository maintainers and reviewers.
- Action needed: Configure branch rules as desired (for example, require Code Owner review only if at least one non-author reviewer is available).
- PR: https://github.com/hannasdev/model-switchboard/pull/6
