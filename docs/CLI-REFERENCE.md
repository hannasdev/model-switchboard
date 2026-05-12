# CLI Reference

This document describes the command-line interface (CLI) for Model Switchboard, including inputs, outputs, and usage examples.

## Installation

```bash
npm install -g model-switchboard
# or use via npx:
npx model-switchboard <command> [options]
```

## Global Options

- `--help` - Display help information
- `--json` - Output in JSON format (where applicable)

## Commands

### switchboard [options] "prompt"

Routes a single prompt and launches Claude with the selected model/effort settings.

**Input:**
- `prompt` (required unless `--interactive`) - The prompt text to send. A prompt and `--interactive` are mutually exclusive.
- `--interactive` - Start an interactive session with route-aware resumption (no prompt allowed)
- `--dry-run` - Preview the routing decision without launching Claude
- `--stronger` / `--cheaper` / `--stay` - Override routing direction
- `--json` - Output routing decision as JSON
- `--thread-id <id>` - Use a specific thread ID (default: `default`)
- `--store-path <path>` - Override session store path
- `--log-path <path>` - Override turn log path
- `--timeout-ms <ms>` - Override execution timeout (default: `180000`)

**Output:**
- Launches Claude with the routed model and effort level
- Displays routing decision (model, effort, route label)
- Records session state and routing evidence locally

**Exit Codes:**
- `0` - Success
- `1` - Error (missing prompt, invalid configuration, execution failure)

**Example:**
```bash
switchboard "Implement the retry logic for stale session recovery."
```

### switchboard --interactive

Starts an interactive Claude session where each turn is routed independently.

**Input:**
- `--interactive` flag (required; incompatible with a prompt argument)
- `--dry-run` - Preview routing without launching Claude
- `--json` - Output routing decisions as JSON

**Output:**
- Route decision displayed before each turn
- Interactive Claude session maintained
- Session state persisted across turns

**Exit Codes:**
- `0` - Success
- `1` - Error

**Example:**
```bash
switchboard --interactive
```

### switchboard explain

Displays the latest routing decision, reasoning signals, and correlated evidence.

**Input:**
- `--json` - Output as machine-readable JSON

**Output:**
- Routing decision details (route label, model, effort)
- Classification signals that influenced the decision
- Path to associated evidence log
- Timestamp and decision ID

**Exit Codes:**
- `0` - Success (decision found and displayed)
- `1` - Error (no decision history found)

**Example:**
```bash
switchboard explain
switchboard explain --json
```

### switchboard advise [options] "prompt"

Returns a routing recommendation without executing it (advisory mode).

**Input:**
- `--surface <name>` - Specify surface for advisory (e.g., `openai-codex`, `anthropic`, `gemini`)
- `prompt` - The prompt to advise on

**Output:**
- Recommended route (model, effort, reasoning)
- Does NOT launch Claude or modify session state
- Can be piped to other tools or analyzed programmatically

**Exit Codes:**
- `0` - Success
- `1` - Error (invalid surface, missing config)

**Example:**
```bash
switchboard advise --surface openai-codex "Implement the retry logic"
```

### switchboard probe continuity [options]

Validates session continuity for prompt-driven (non-interactive) turns.

**Input:**
- `--no-tools` - Run without external tool integration
- `--inter-turn-delay-ms <ms>` - Delay between probe turns (default: `1000`)
- `--json` - Output results as JSON

**Output:**
- Pass/fail for each continuity check:
  - Session state persisted across turns
  - Route decisions recorded consistently
  - Evidence logs aligned with decisions
- Summary report

**Exit Codes:**
- `0` - All checks passed
- `1` - One or more checks failed

**Example:**
```bash
switchboard probe continuity --no-tools
```

### switchboard probe continuity-interactive [options]

Validates interactive session continuity and session resumption behavior.

**Input:**
- `--json` - Output results as JSON
- `--inter-turn-delay-ms <ms>` - Delay between probe turns

**Output:**
- Pass/fail for:
  - Interactive session state persists
  - Session can resume after interruption
  - Route decisions recorded in interactive context
  - Hook events correlate with turns
- Detailed check results

**Exit Codes:**
- `0` - All checks passed
- `1` - One or more checks failed

**Example:**
```bash
switchboard probe continuity-interactive --json
```

## Environment Variables

### API Keys

- `ANTHROPIC_API_KEY` - Anthropic API key for Claude (required for Anthropic-routed turns)
- `OPENAI_API_KEY` - OpenAI API key (required for openai-codex routing)
- `GOOGLE_API_KEY` - Google API key (required for Gemini routing)

### Path Overrides (CLI flags; no environment variable equivalents)

Paths are controlled via CLI flags rather than environment variables:
- `--store-path <path>` - Session store file (default: `~/.model-switchboard/switchboard-sessions.json`)
- `--log-path <path>` - Turn log file (default: `~/.model-switchboard/switchboard-turns.ndjson`)
- `--route-context-path <path>` - Route context file (default: `~/.model-switchboard/switchboard-route-context.json`)
- `--hook-log-path <path>` - Hook event log (default: `~/.model-switchboard/claude-hook-events.ndjson`)

## Output Formats

### Routing Decision (JSON)

The turn result object (emitted with `--json`) contains:

```json
{
  "routeDecision": {
    "label": "best coder",
    "taskType": "multi_file_refactor",
    "confidence": 0.9,
    "continuityCost": "low",
    "escalationPolicy": { "applied": false, "reasons": [] }
  },
  "routingDecision": {
    "schemaVersion": "0.1.0-experimental",
    "status": "ok",
    "selectedTargetId": "anthropic-coder"
  },
  "selectedClaude": {
    "model": "claude-opus-4-5",
    "effort": "high",
    "sessionId": "..."
  },
  "status": "live",
  "threadId": "default"
}
```

### Session State

Session state is stored in a single JSON file at `~/.model-switchboard/switchboard-sessions.json` (override with `--store-path`). Turn logs are written as newline-delimited JSON at `~/.model-switchboard/switchboard-turns.ndjson`.

## Common Use Cases

### Single-turn routing
```bash
switchboard "What's the current state of the system?"
```

### Interactive development session
```bash
switchboard --interactive
```

### Audit a routing decision
```bash
switchboard explain --json | jq .reasoning
```

### Dry-run mode (preview route without launching)
```bash
switchboard --dry-run "Implement the retry logic"
```

### Validate continuity before release
```bash
npm run switchboard:continuity
```

## Exit Code Reference

| Code | Meaning |
| --- | --- |
| 0 | Command succeeded |
| 1 | Error (configuration, routing, execution, missing prompt) |

## Troubleshooting

**No session found:**
Ensure you've run at least one routed prompt in this session directory.

**Route not recognized:**
Check available routes with `switchboard advise --help` or verify configuration.

**Claude not launching:**
Ensure `ANTHROPIC_API_KEY` is set and valid. Check `switchboard explain` for routing details.

For more information, see [ARCHITECTURE-SPEC.md](ARCHITECTURE-SPEC.md) and [README.md](../README.md).
