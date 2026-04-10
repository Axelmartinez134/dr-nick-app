# Local Browser Automation Standard

Use this exact Chrome launch command for future local browser automation workflows in this repo.

This applies to:

- Modash local automation
- Instagram local automation
- future browser-attached local workflows

## Standard command

```bash
open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.automation-chrome"
```

## Why this is the standard

- one dedicated automation browser profile
- one dedicated debugging port
- one consistent logged-in environment
- fewer session mismatches between scripts
- simpler local instructions moving forward

## Rule

If a local automation script needs to attach to Chrome, it should assume:

- debugging port: `9222`
- browser profile: `~/.automation-chrome`

Do not create a new per-tool Chrome profile unless there is a very specific reason.

## Localhost control-plane note

If the web app later launches or queues local browser work through a localhost bridge, the bridge
should still attach to this same Chrome session and profile. The app may be the control plane,
but browser execution remains local to this machine and this dedicated automation Chrome profile.

## Current operator setup

For the current Instagram outreach workflow UI to work end-to-end, the operator must still:

1. launch this Chrome profile manually with remote debugging enabled
2. keep that profile logged into Instagram
3. start the localhost bridge manually:

```bash
npm run dm:start-local-bridge
```

The current implementation does **not** auto-launch Chrome or auto-start the bridge from the UI.
