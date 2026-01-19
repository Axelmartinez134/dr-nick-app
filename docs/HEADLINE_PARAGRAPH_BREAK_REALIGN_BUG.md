# Headline paragraph breaks → Realign truncation / disappearing text (Investigation Log)

## Why this doc exists
We hit a high-impact editor issue where editing the **Headline** rich text (specifically inserting an **Enter / paragraph break**) can cause **Realign / live layout** to decide there is “no space,” truncate the headline with an ellipsis (`…`), and **drop the rest of the text** (often including the body).

This doc is the working record of:
- The original bug and intended behavior
- What the logs show (evidence)
- What we changed/tried (including rollbacks)
- The most likely root cause areas
- The next best debugging steps

This is meant to be a long-term reference as we iterate safely.

## Original issue (user-reported)
In the `/editor` experience:
- When the Headline has **no paragraph breaks** (single line), things render and Realign correctly.
- When the Headline includes a **paragraph break** (pressing Enter in the Headline rich text editor), the system can:
  - Conclude there is “not space on canvas”
  - Truncate the first line so it ends with `…`
  - Cause the remaining text to disappear after Realign / reflow

## Goal / intended behavior
### Headline newline semantics
- **Press Enter once** in Headline:
  - Should create the next headline line as a **new on-canvas text object below the first**
  - With **normal line-to-line spacing** (no “blank line” gap)
- **Press Enter twice** (blank line):
  - Should produce an **empty line/gap** exactly like the rich text editor shows

### Layout behavior
- “Realign runs should do exactly what they are doing now,” meaning:
  - Keep the existing pipeline/heuristics
  - But do not treat a Headline paragraph break as “layout failure” that nukes content

## Key system facts (how text is represented)
### Rich text storage format
`RichTextInput` encodes breaks as:
- **Enter** → paragraph boundary stored as `\n\n`
- **Shift+Enter** → soft line break stored as `\n`

So “two headline rows” in the RTE typically becomes:
`"LINE 1\n\nLINE 2"`

## Evidence from logs (reproduced)
Example reproduced sequence (high-signal excerpts):

1) Immediately after pressing Enter (before blur / before live reflow fully settles):
- TightText shows multiple lines still on canvas
- But line 2 is suspicious:
  - `type=textbox`
  - `textW=0`
  - text begins with a **leading space**: `" The Inflammation Trap"`

2) On blur (RTE blur) → live layout recompute happens:
- `📐 Live layout slide ... headlineLen=41 bodyLen=160 ...`
- `✅ Live layout ... lines=1`
- Resulting visible line:
  - `OXIDATIVE STRESS:…`

Interpretation:
- Live layout produced **only one line total** (headline with ellipsis).
- Even though `bodyLen=160`, body was not placed at all.
- This matches a failure mode where headline is considered “incomplete” → `truncated=true` → algorithm returns early with only best-effort lines and adds `…` to last line.

## Most likely root cause (current hypothesis)
The deterministic wrap engine (`wrapFlowLayout`) tokenizes headline text into words and `break` tokens for `\n`.

If headline contains any newline:
- The headline placement loop may stop early when encountering a `break` token.
- If any headline words remain unplaced, the algorithm marks the layout as truncated.
- Once truncated, subsequent block placement (body) may be skipped or severely reduced, resulting in only a single `…` line.

The “line 2 has leading space and textW=0” strongly suggests a second contributing factor:
- ContentEditable can temporarily “move” trailing whitespace around newline boundaries.
- That can yield transient headline text like:
  - `"OXIDATIVE STRESS: \n\nThe Inflammation Trap"` (note space before newline)
  - or `"OXIDATIVE STRESS:\n\n The Inflammation Trap"` (leading space on new paragraph)
- That transient state can cause weird Fabric measurement / object choice (`Textbox` vs `IText`) and can influence the layout engine if it runs on that intermediate representation.

## Where to look in code (primary targets)
- **Layout algorithm**: `src/lib/wrap-flow-layout.ts`
  - Headline tokenization and how newline tokens are treated
  - Headline placement loop stop conditions
  - The condition that sets `truncated=true` for headline incompleteness
  - Body placement behavior when `truncated=true`
- **Headline edit wiring**: `src/app/editor/EditorShell.tsx`
  - `onChangeHeadlineRichText` (what triggers live layout, when it runs, whether it runs on intermediate text)
- **Canvas text rendering diagnostics**: `src/app/components/health/marketing/ai-carousel/CarouselPreviewVision.tsx`
  - “TightText” logging indicates which Fabric object type was used and the measured widths

## What we tried (and why we rolled it back)
We attempted multiple fixes to get newline behavior correct. Some changes were pushed without explicit request (mistake), and we reverted to a known-good commit to restore baseline behavior.

### Known-good baseline we reverted to
- Local repo hard reset to: `eee6080` (“Editor: center empty-state placeholders in slide canvas”)

### Things we learned from failed attempts
- Simply “consuming newline tokens” in the headline loop can prevent total disappearance, but if we mis-handle newline runs or y-advancement, it can introduce large unexpected gaps.
- If layout recompute runs on an intermediate contenteditable representation, it can produce unstable results (e.g., leading-space second line, `textW=0`).

## Immediate next investigation steps (recommended)
These steps are designed to isolate the issue with minimal surface area.

### 1) Add surgical debug logs in `wrap-flow-layout.ts` (no behavior change)
Add logging (guarded, low-noise) for headline layout when `headline.includes("\n")`:
- Token sequence around the newline boundary: word vs break, and counts
- The headline loop’s `hIdx` progression and why it stops
- Whether `truncated` flips to true due to remaining word tokens

Goal: confirm whether headline newline handling is prematurely stopping and causing `truncated=true`.

### 2) Log the exact headline string at the moment layout is computed
We need to know whether the layout engine sees:
- `"LINE1\n\nLINE2"` (expected)
- or `"LINE1 \n\nLINE2"` / `"LINE1\n\n LINE2"` (whitespace artifact)
- or a larger newline run

This tells us whether the issue is:
- layout logic alone, or
- layout logic + transient contenteditable text states

### 3) Confirm whether truncation of headline should or should not suppress body placement
Current behavior suggests truncation can starve body placement.
We should decide policy:
- If headline truncates, should body still render (best-effort), or should it be suppressed?

## Constraints / process notes
- Do **not** commit/push without explicit instruction from the user.
- Prefer minimal, reversible changes.
- Keep `docs/EDITOR_CODEBASE_MAP.md` updated for any long-term architectural changes and add Manual QA entries.

