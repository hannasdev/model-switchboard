# Replay Guide: Testing Router Policies

**Milestone 4** establishes infrastructure for offline decision evaluation. This guide explains how to use the current replay helpers to check recorded decision metadata and policy-version consistency against historical evidence.

## Overview

The replay system allows you to:

1. **Load historical evidence** from your Switchboard logs
2. **Check recorded decisions** against a target policy version
3. **Compare policy-version alignment** across sessions and turns
4. **Validate policy changes** before deploying them

Note: current replay helpers do not recompute routing decisions from raw inputs. `matches` indicates policy-version equality between recorded evidence and the provided `policyVersion`.

## Quick Start

### 1. Collect Session Evidence

```bash
node --input-type=module -e "
import { loadSessionEvidence } from './src/switchboard/workflow.js';

const evidence = loadSessionEvidence({
  logPath: process.env.HOME + '/.model-switchboard/switchboard-turns.ndjson',
  sessionId: 'my-session-123'
});

console.log('Loaded ' + evidence.length + ' decisions from session');
"
```

### 2. Replay a Single Decision

```bash
node --input-type=module -e "
import { loadSessionEvidence, replayRoutingDecision } from './src/switchboard/workflow.js';

const evidence = loadSessionEvidence({
  logPath: process.env.HOME + '/.model-switchboard/switchboard-turns.ndjson',
  sessionId: 'my-session-123'
});

const result = replayRoutingDecision({
  evidence: evidence[0],
  policyVersion: '0.1.0-experimental'
});

console.log(result);
// {
//   status: 'replayed',
//   originalSelectedTargetId: 'anthropic-coder',
//   matches: true,
//   confidence: 0.92,
//   ...
// }
"
```

### 3. Evaluate Policy on Full Session

```bash
node --input-type=module -e "
import { loadSessionEvidence, evaluatePolicyOnEvidence } from './src/switchboard/workflow.js';

const evidence = loadSessionEvidence({
  logPath: process.env.HOME + '/.model-switchboard/switchboard-turns.ndjson',
  sessionId: 'my-session-123'
});

const evaluation = evaluatePolicyOnEvidence({
  evidenceSet: evidence,
  policyVersion: '0.1.0-experimental'
});

console.log(evaluation);
// {
//   status: 'evaluated',
//   totalDecisions: 15,
//   matchCount: 13,
//   matchRate: '86.7%',
//   avgConfidence: '88.2%',
//   switchingReasons: { no_switch: 10, continuity_cost: 3, escalation: 2 },
//   ...
// }
"
```

## Workflow: Validate Policy Version Alignment

### Scenario

You want to validate policy rollout consistency:
- *Change:* You introduced policy version `0.2.0` and want to check which historical decisions were logged under older versions.

### Steps

#### 1. Run current policy on stored evidence

```bash
node --input-type=module -e "
import { loadSessionEvidence, evaluatePolicyOnEvidence } from './src/switchboard/workflow.js';
const evidence = loadSessionEvidence({ 
  logPath: process.env.HOME + '/.model-switchboard/switchboard-turns.ndjson',
  sessionId: 'my-session-123'
});
const baseline = evaluatePolicyOnEvidence({
  evidenceSet: evidence,
  policyVersion: '0.1.0-experimental'
});
console.log(JSON.stringify(baseline, null, 2));
"
```

#### 2. Compare evidence against target policy version

```bash
node --input-type=module -e "
import { loadSessionEvidence, replayRoutingDecision } from './src/switchboard/workflow.js';
const evidence = loadSessionEvidence({ 
  logPath: process.env.HOME + '/.model-switchboard/switchboard-turns.ndjson',
  sessionId: 'my-session-123'
});
const versionResults = evidence.map(e => replayRoutingDecision({ evidence: e, policyVersion: '0.2.0' }));
const mismatches = versionResults.filter(r => !r.matches);
console.log(\`Version mismatches: \${mismatches.length} / \${evidence.length}\`);
"
```

#### 3. Compare results

- **If match rate is high:** Most decisions were already logged under the target policy version
- **If many mismatches:** Evidence contains decisions logged under other policy versions
- **If match rate is 0%:** The requested policy version is absent from this session's evidence

#### 4. Run tests and validate

```bash
npm test
git commit -m "policy: adjust continuity-cost thresholds"
```

## Output Interpretation

### Match Rate

- **100% match:** All recorded decisions already use the compared policy version
- **>90% match:** Most decisions use the compared policy version
- **75-90% match:** Mixed-policy evidence; investigate rollout boundaries
- **<75% match:** Majority of decisions were recorded under different policy versions

### Confidence

Average router confidence (0.0-1.0) in the decisions:
- **>0.85:** High confidence, good signal
- **0.70-0.85:** Medium confidence, monitor regressions
- **<0.70:** Low confidence, consider escalation or review

### Switching Reasons Distribution

Shows which decision factors triggered target switches:
- `no_switch`: No switch (stayed on current)
- `continuity_cost`: Continuity cost evaluation triggered switch
- `capability_gap`: Hard constraint (missing capability) triggered switch
- `user_override`: User override triggered switch
- `escalation`: Escalation policy (low confidence, etc.) triggered switch
- `availability`: Availability constraint triggered switch

High switching frequency may indicate:
- More aggressive policy (good for certain modes)
- Over-switching (may hurt continuity)

## Advanced: Batch Policy Evaluation

Test multiple policy versions at once:

```javascript
import { loadSessionEvidence, replayRoutingDecision } from './src/switchboard/workflow.js';

const evidence = loadSessionEvidence({ logPath: '...', sessionId: '...' });

const policies = ['0.1.0-experimental', '0.2.0-draft', '0.2.0-conservative'];
const results = {};

for (const policy of policies) {
  const replayed = evidence.map(e => replayRoutingDecision({ evidence: e, policyVersion: policy }));
  const matches = replayed.filter(r => r.matches).length;
  results[policy] = {
    matchCount: matches,
    matchRate: ((matches / evidence.length) * 100).toFixed(1) + '%'
  };
}

console.log(results);
```

## Fixtures for Testing

The test suite includes pre-recorded evidence fixtures for deterministic policy evaluation:

```javascript
import { planSwitchboardTurn } from './src/switchboard/workflow.js';
import assert from 'assert/strict';

// Recorded evidence from a specific session
const fixtures = {
  sessionId: 'test-session-123',
  threadId: 'test-thread-1',
  evidence: [
    // ... evidence objects loaded from switchboard-turns.ndjson
  ]
};

// Test a policy against the loaded evidence
fixtures.evidence.forEach((e, idx) => {
  const result = replayRoutingDecision({ 
    evidence: e,
    policyVersion: '0.2.0'
  });
  assert.equal(result.matches, true, `Decision ${idx} should match`);
});
```

## Limitations and Future Work

Current replay system:

- **Scope:** Checks recorded metadata consistency, not re-computed routing outcomes
- **Policy input:** Compares against recorded policy versions only
- **Outcome:** Does not include outcome feedback (success/failure)

Future enhancements:

- **Outcome-aware evaluation:** Factor in whether decisions succeeded or failed
- **True policy replay:** Recompute routing decisions from evidence inputs and compare selected targets/outcomes
- **A/B testing:** Compare two policies head-to-head with statistical significance
- **Regression detection:** Automatic flagging of decisions that would have regressed
- **Replay optimizations:** Cache results for faster iteration

## Troubleshooting

### No evidence found for session ID

- Verify the session ID matches what's in your logs
- Check log file path is correct: `ls -la ~/.model-switchboard/switchboard-turns.ndjson`
- Ensure the session has run at least one turn

### All decisions marked as mismatch

- Policy version in evidence may not match what you're comparing against
- Check that policy changes are deployed
- Verify targets registry matches what was available during original run

### Unexpected switching reasons

- Legacy log entries may not have full attribution data
- Replay on M4+ evidence (generated after this milestone) for accurate attribution

## See Also

- [Router Contracts](./contracts/router-contracts.md) — Normalized event shapes
- [Attribution Store](../src/switchboard/attribution_store.js) — Outcome tracking API
- [Decision Log](./decision-log.md) — Policy decisions and rationales
