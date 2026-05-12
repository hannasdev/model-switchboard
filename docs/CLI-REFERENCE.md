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
- `--version` - Display version number
- `--json` - Output in JSON format (where applicable)

## Commands

### switchboard [options] [prompt]

Routes a single prompt and launches Claude with the selected model/effort settings.

**Input:**
- `prompt` (optional) - The prompt text to send. If omitted, enters interactive mode.
- `--interactive` - Start an interactive session with route-aware resumption
- `--json` - Output routing decision as JSON

**Output:**
- Launches Claude with the routed model and effort level
- Displays routing decision (model, effort, route label)
- Records session state and routing evidence locally

**Exit Codes:**
- `0` - Success
- `1` - Error (missing configuration, invalid surface, etc.)
- `2` - User cancelled operation

**Example:**
```bash
switchboard "Implement the retry logic for stale session recovery."
```

### switchboard --interactive

Starts an interactive Claude session where each turn is routed independently.

**Input:**
- Prompts entered at the CLI prompt

**Output:**
- Route decision displayed before each turn
- Interactive Claude session maintained
- Session state persisted across turns

**Exit Codes:**
- `0` - Success (user exited normally)
- `1` - Error
- `2` - User cancelled

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
- `--inter-turn-delay-ms <ms>` - Delay between probe turns (default: 100)
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

### Configuration

- `CLAUDE_API_KEY` - Anthropic API key for Claude (required for routing to Claude)
- `OPENAI_API_KEY` - OpenAI API key (required for openai-codex routing)
- `GOOGLE_API_KEY` - Google API key for Gemini (required for gemini routing)

### Session Management

- `SWITCHBOARD_HOME` - Base directory for session storage (default: `$HOME/.switchboard`)
- `SWITCHBOARD_SESSION_ID` - Override session ID (default: auto-generated)

### Behavior

- `SWITCHBOARD_DRY_RUN` - Set to `1` to preview routes without launching Claude
- `SWITCHBOARD_EVIDENCE_LEVEL` - Set to `detailed`, `standard`, or `minimal` (default: `standard`)

## Output Formats

### Routing Decision (JSON)

```json
{
  "route": "standard",
  "model": "claude-3-5-sonnet",
  "effort": "standard",
  "reasoning": ["multi-turn task", "refactoring implied"],
  "policyVersion": "1.0",
  "decisionId": "d-abc123...",
  "timestamp": "2026-05-12T15:30:00Z"
}
```

### Session State

Session state is stored in `$SWITCHBOARD_HOME/sessions/` as JSON files containing:
- Turn history
- Routing decisions
- Claude session information
- Attribution data

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
SWITCHBOARD_DRY_RUN=1 switchboard "Implement the retry logic"
```

### Validate continuity before release
```bash
npm run switchboard:continuity
```

## Exit Code Reference

| Code | Meaning |
| --- | --- |
| 0 | Command succeeded |
| 1 | Error (configuration, routing, execution) |
| 2 | User cancelled (interactive mode) |

## Troubleshooting

**No session found:**
Ensure you've run at least one routed prompt in this session directory.

**Route not recognized:**
Check available routes with `switchboard advise --help` or verify configuration.

**Claude not launching:**
Ensure `CLAUDE_API_KEY` is set and valid. Check `switchboard explain` for routing details.

For more information, see [ARCHITECTURE-SPEC.md](ARCHITECTURE-SPEC.md) and [README.md](../README.md).
