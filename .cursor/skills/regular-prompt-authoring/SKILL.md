---
name: regular-prompt-authoring
description: Analyze existing regular saved carousel prompts and author one new regular saved prompt from scratch. Use when the user wants help creating a new regular saved prompt, asks for a prompt title and body, mentions audience effect or prompt goal, or wants a repeatable prompt-authoring workflow for the saved prompt system.
---
# Regular Prompt Authoring

Use this skill to author one new `regular` saved prompt for the carousel copy system.

## What This Skill Produces

Return the final draft in this exact shape:

```text
Title: ...
Prompt: ...
```

Do not return database rows, implementation code, or extra metadata unless the user explicitly asks.

## Operating Assumptions

- This skill is only for the `regular` saved prompt system.
- Brand voice is injected externally by the app, so do not restate brand context inside the authored prompt.
- Keep the prompt structurally disciplined and comprehensive by default.
- Every authored prompt must include explicit 6-slide output formatting.
- Exclude weak, placeholder, duplicate, or incomplete historical prompts from the canonical pattern.
- Ask clarifying questions in one batch, ordered from highest-impact to lowest-impact.
- Do not confuse a clean structure with a strong prompt. Preserve the execution intelligence that makes prompts actually useful.

## Workflow

1. Read `ARCHITECTURE.md` before drafting.
2. Read `QUESTION-SET.md` and ask one batched clarification pass if required.
3. Read `EXAMPLES.md` if you need usage phrasing or output-shape reminders.
4. Synthesize the canonical pattern from the architecture instead of copying one old prompt verbatim.
5. Draft exactly one new saved prompt with:
   - a title
   - a prompt body
6. Make sure the authored prompt includes both:
   - core structure
   - execution doctrine
7. Keep the authored prompt focused on:
   - prompt goal
   - desired audience effect
   - pull-through mechanism
   - slide logic
   - hard rules
   - output format
   - validation guidance
8. Do not hardcode brand context, audience bio, offer details, or app-injected voice blocks unless the user explicitly asks for them in the prompt itself.

## Authoring Rules

- Prefer one canonical structure with modular variations.
- Create new archetypes when needed, but preserve the deeper shared architecture.
- Keep instructions natural and direct.
- Avoid bloated historical baggage unless it clearly improves output quality.
- Do not include placeholders unless the user asks for them.
- Do not include content-type-specific constraints if those should live in brand voice or elsewhere.
- Preserve explicit output structure for `Slide 1` through `Slide 6` plus `Caption`.
- Add back the “meat”: slide-level jobs, payoff logic, specificity standards, and anti-generic safeguards.
- For practical or technical prompts, optimize for clarity, confidence, and implementability rather than generic explanation.
- Validation should check quality and payoff, not just formatting.

## If Information Is Missing

Ask for the missing details in one batch using the ordering from `QUESTION-SET.md`.

Typical missing inputs are:

- the prompt goal
- the desired audience effect
- the pull-through mechanism
- the intended archetype
- the confusion, resistance, or belief the prompt should resolve
- the payoff the reader should feel by slide 5
- any required CTA or ending behavior
- any must-have exclusions

## Additional Resources

- Canonical architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- Batched clarification flow: [QUESTION-SET.md](QUESTION-SET.md)
- Usage pattern and examples: [EXAMPLES.md](EXAMPLES.md)
