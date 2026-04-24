# pi-local-claude-loader

A Pi extension that loads a local context file on `session_start` and appends it to the agent's system prompt as additional highest-priority local context.

## Behavior

- Runs on `session_start`
- Checks only the current working directory
- By default, looks for these files in order:
  1. `claude.local.md`
  2. `agents.local.md`
- Matches configured file names case-insensitively
- If multiple configured files exist, loads the first configured match only
- No-ops silently when no configured file is present
- Logs empty or oversized files at `error` level by default
- Logs successful file loads at `info` level when enabled
- Appends local context without replacing existing `CLAUDE.md` / `AGENTS.md`
- Uses a configurable max size, defaulting to Pi's 50KB output-size convention

## Configuration

Config files are optional. Project config overrides global config.

- Global: `~/.pi/agent/extensions/claude-local.json`
- Project: `<cwd>/.pi/extensions/claude-local.json`

Default config:

```json
{
  "fileNames": ["claude.local.md", "agents.local.md"],
  "maxBytes": 51200,
  "logLevel": "error"
}
```

Example:

```json
{
  "fileNames": ["agents.local.md", "claude.local.md"],
  "maxBytes": 16384,
  "logLevel": "info"
}
```

## Install

Install the extension from GitHub:

```bash
pi install git:github.com/boga/pi-local-claude-loader
```

## Load it locally for development

From this repository root:

```bash
pi -e .
```

Or load the source file directly:

```bash
pi -e ./src/index.ts
```

Or copy it into Pi's auto-discovery location:

```bash
mkdir -p .pi/extensions
cp ./src/index.ts .pi/extensions/claude-local.ts
pi
```

## Verify

```bash
mkdir -p /tmp/pi-local-claude-loader-demo
cd /tmp/pi-local-claude-loader-demo
printf '# Local rules\n\n- Prefer tiny commits\n' > claude.local.md
pi -e /Users/miju/Work/pi-local-claude-loader.fix-pi-extension-loader
```

You should see `Loaded local context file: claude.local.md` when the session starts.
