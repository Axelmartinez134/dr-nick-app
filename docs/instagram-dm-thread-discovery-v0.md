# Instagram DM Thread Discovery v0

This is the lean local spike for proving one thing:

- Can a local script attach to your real Chrome session, search an Instagram username in DMs, open the thread, and capture the `/direct/t/...` URL?

## Files

- `scripts/instagram_dm/discover_threads.mjs`
- `scripts/instagram_dm/usernames.json`
- `scripts/instagram_dm/test_leads.json`
- `scripts/instagram_dm/output/results.json`
- `scripts/instagram_dm/output/screenshots/*`

## One-time setup

From the repo root:

```bash
npm install
```

If Playwright asks for browser binaries later, run:

```bash
npx playwright install chromium
```

## Run flow

### 1. Open the special Chrome window

```bash
open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.ig-dm-debug-chrome"
```

### 2. In that Chrome window

- Log into Instagram manually.
- Make sure you can open your DMs normally.
- Leave the Chrome window open.

### 3. Edit the input usernames

Put the test usernames in:

- `scripts/instagram_dm/usernames.json`

The current file already contains the first 10 test leads.

### 4. Run the script

```bash
npm run dm:discover-threads
```

## What the script does

For each username, it will:

1. attach to your current Chrome session
2. go to `https://www.instagram.com/direct/inbox/`
3. search the username
4. try to open the matching thread
5. capture the current URL
6. verify the thread appears to belong to that username
7. save a screenshot
8. append the result to `results.json`

## Output

Results are written to:

- `scripts/instagram_dm/output/results.json`

Screenshots are written to:

- `scripts/instagram_dm/output/screenshots/`

## Success criteria

A username counts as a success only if:

- the script opens a `/direct/t/...` URL
- and it can verify that the opened thread appears to belong to that username

## Failure examples

- no search box found
- no matching search result
- wrong thread opened
- URL did not become `/direct/t/...`
- participant verification failed
- Instagram logged you out

## Notes

- The script is intentionally conservative. If a result is ambiguous, it should fail rather than guessing.
- This is a local spike only. It does not write to your app database yet.
