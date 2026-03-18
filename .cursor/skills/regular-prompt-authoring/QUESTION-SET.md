# Recommended Question Set

Ask these questions in one batch, in this order, whenever the user wants help creating one new `regular` saved prompt from scratch.

Only ask the questions that are still unanswered.

## Priority Order

### 1. Prompt Goal

What should this prompt make the model do at the highest level?

Examples:

- challenge a belief
- create recognition
- tell a story
- break down a framework
- create ranked review content
- produce a curiosity-driven carousel

### 2. Desired Audience Effect

What should the audience feel, think, or do by the end?

Examples:

- feel seen
- feel called out
- feel unresolved curiosity
- feel convinced
- feel relief
- feel ready to comment or act

### 3. Pull-Through Mechanism

Why should the reader keep swiping through all 6 slides?

Examples:

- unresolved curiosity
- emotional recognition
- belief collapse
- increasing clarity
- evidence reveal
- a story that needs resolution

This question is critical. It prevents the drafted prompt from becoming informative but flat.

### 4. Archetype

Which structure should this prompt use?

If the user does not know, offer:

- Story
- Mirror
- Hot Take
- Myth Kill
- Curiosity Loop
- Methodology Breakdown
- Ranked Review / Evidence
- New archetype

### 5. Reader Friction Or Pain Point

What specific confusion, resistance, pain point, or false belief should the prompt resolve?

Examples:

- the process feels too technical
- the topic feels overwhelming
- the reader thinks this is too advanced for them
- the reader believes the wrong method is correct
- the reader has the symptom but not the language for it

### 6. Payoff Requirement

By slide 5, what should the reader now clearly understand, believe, or feel capable of doing?

Examples:

- understand the workflow in plain language
- feel capable of implementing the process themselves
- see exactly why the old belief was wrong
- feel personally recognized and less ashamed

### 7. Slide-End Behavior

How should slide 6 land?

Examples:

- soft takeaway
- quotable line
- identity reframe
- CTA
- mystery-driven close

### 8. Caption Role

What should the caption do relative to the slides?

Examples:

- deepen the lesson
- expand with extra value
- ask a question
- carry the CTA
- stay minimal

### 9. Non-Negotiable Rules

What must always be true in the output?

Examples:

- character limits
- punctuation bans
- no hashtags
- simple language
- one idea per slide

### 10. Must-Avoid Moves

What should the prompt explicitly forbid?

Examples:

- generic wellness language
- preachy tone
- clickbait without payoff
- dense paragraphs
- repeating the source
- over-explaining
- business fluff
- calling something practical without making it practical

### 11. Analytical Preface

Should the prompt ask the model to extract anything before writing the slides?

Examples:

- core message
- hidden pattern
- myth
- methodology
- stance
- moment

Default:

- omit this unless it clearly improves quality

## Recommended Batched Ask Format

Use a single grouped message like this:

```text
Before I draft the new regular saved prompt, answer these in one pass:

1. What is the prompt goal?
2. What audience effect should it create?
3. Why should the reader keep swiping through all 6 slides?
4. Which archetype should it use, or should I invent a new one?
5. What specific confusion, pain point, or false belief should the prompt resolve?
6. By slide 5, what should the reader clearly understand, believe, or feel capable of doing?
7. How should slide 6 land?
8. What should the caption do?
9. What rules are non-negotiable?
10. What should the prompt explicitly avoid?
11. Should I include any pre-writing extraction section, or keep it straight to output?
```

## If The User Is Unsure

If the user does not know the answer to a question:

- recommend a default
- explain it in one sentence
- keep moving

Do not turn uncertainty into a long consultation unless the user asks for it.

## What Not To Ask By Default

Do not ask for these unless the user explicitly wants them inside the saved prompt:

- brand biography
- long audience bio
- offer description
- account handle
- injected brand voice text
- app implementation details

Those are not part of the canonical saved-prompt authoring flow.

## Quality Reminder

If the answers are brief, the drafted prompt still needs to be strong.

Do not mirror the brevity of the user's answers into a thin prompt.
Instead:

- preserve the requested constraints
- infer the appropriate execution doctrine
- keep the result robust and structurally disciplined
