# Decision Log

Use this log for deferred-to-committed design decisions referenced by [ROUTER-PHASE-PLAN.md](ROUTER-PHASE-PLAN.md).

A decision is not treated as committed unless a completed entry exists.

## Entry Template

```text
Decision ID: DEC-YYYY-MM-DD-<slug>
Related deferred item: <item number and title>
Status: proposed | committed | deferred | rejected
Date: <YYYY-MM-DD>
Owners: <names>

Context:
- What was uncertain and why this decision is being reviewed now.

Options considered:
- Option A: <summary>
- Option B: <summary>
- Option C: <summary>

Tradeoffs:
- Option A: <key pros/cons>
- Option B: <key pros/cons>
- Option C: <key pros/cons>

Verification signal:
- Expected signal from phase plan:
- Evidence observed:

Decision:
- Chosen option:
- Scope of commitment:
- What remains intentionally deferred:

Consequences:
- Near-term implementation impact:
- Test and replay impact:
- Migration impact:

Follow-up:
- Next review milestone:
- Linked artifacts (logs, fixtures, docs, PRs):
```

## Initial Placeholder

Decision ID: DEC-2026-05-10-router-phase-governance
Related deferred item: process bootstrap
Status: committed
Date: 2026-05-10
Owners: team

Context:
- Created baseline decision log structure so milestone reviews have a single durable record.

Options considered:
- Option A: keep decisions in ad hoc PR comments.
- Option B: keep decisions in a dedicated docs log.

Tradeoffs:
- Option A: lower setup overhead, weaker auditability.
- Option B: stronger auditability, slight process overhead.

Verification signal:
- Expected signal from phase plan: explicit evidence-backed promotion of deferred commitments.
- Evidence observed: decision template and storage guidance now present in phase plan and this log.

Decision:
- Chosen option: Option B.
- Scope of commitment: use this file for deferred-commitment reviews in current phase.
- What remains intentionally deferred: final long-term ADR format and automation.

Consequences:
- Near-term implementation impact: low.
- Test and replay impact: none.
- Migration impact: low; can be transformed into ADRs later.

Follow-up:
- Next review milestone: Milestone 1 closeout.
- Linked artifacts (logs, fixtures, docs, PRs): docs/ROUTER-PHASE-PLAN.md, docs/contracts/router-contracts.md

## Milestone 1 Closeout

Decision ID: DEC-2026-05-10-milestone-1-router-contracts-closeout
Related deferred item: milestone closeout governance
Status: committed
Date: 2026-05-10
Owners: team

Context:
- Milestone 1 required an experimental, minimal, revision-friendly contract baseline plus explicit Claude mapping without claiming universal behavior.

Options considered:
- Option A: treat Milestone 1 as complete after contract file creation only.
- Option B: treat Milestone 1 as complete only after acceptance criteria mapping and decision-log closeout.

Tradeoffs:
- Option A: faster progress marker, weaker audit trail and weaker governance enforcement.
- Option B: slightly more process overhead, stronger evidence and repeatable milestone governance.

Verification signal:
- Expected signal from phase plan: Milestone 1 acceptance criteria met and documented.
- Evidence observed:
  - `docs/contracts/router-contracts.md` exists and is implementation-usable.
  - Contract version is explicitly `0.1.0-experimental` and provisional.
  - Minimal normative core plus Claude mapping appendix are present.
  - Core contracts represent handoff/context-transfer.
  - Phase and contract docs both include deferred-commitment guardrails.

Decision:
- Chosen option: Option B.
- Scope of commitment: Milestone 1 is formally complete as of 2026-05-10.
- What remains intentionally deferred: taxonomy freeze, numeric continuity scoring, strict constraint enforcement depth, attribution ontology stabilization, and extraction timeline.

Consequences:
- Near-term implementation impact: proceed to Milestone 2 with a stable experimental contract baseline.
- Test and replay impact: enables contract-backed test and replay work in next milestones.
- Migration impact: low; experimental schema remains revision-friendly.

Follow-up:
- Next review milestone: Milestone 2 plan-to-implementation checkpoint.
- Linked artifacts (logs, fixtures, docs, PRs): docs/ROUTER-PHASE-PLAN.md, docs/contracts/router-contracts.md
