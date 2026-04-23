# pi-local-claude-loader

A Pi extension that loads `claude.local.md` on `session_start` and appends it to the agent's system prompt as additional highest-priority local context.

## Behavior

- Runs on `session_start`
- Checks only the current working directory
- Matches `claude.local.md` case-insensitively
- No-ops when the file is missing
- Logs:
  - `Loaded claude.local.md`
  - `claude.local.md empty; skipping`
  - `claude.local.md exceeds 51200 bytes; skipping`
- Appends local context without replacing existing `CLAUDE.md` / `AGENTS.md`
- Uses Pi's 50KB output-size convention as the safety limit

## Load it

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

You should see `Loaded claude.local.md` when the session starts.
