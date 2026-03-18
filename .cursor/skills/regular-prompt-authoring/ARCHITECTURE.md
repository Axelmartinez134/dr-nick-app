# Prompt Architecture Map

This document defines the canonical architecture for authoring one new `regular` saved prompt for the carousel copy system.

It is derived from the strongest existing prompts while intentionally excluding:

- empty prompts
- placeholders
- obvious duplicates
- low-signal scratch prompts
- malformed or incomplete prompts

## Core Principle

A strong saved prompt is not just a neat template. It is a controlled behavior spec for the model.

The strongest historical prompts do two things at once:

1. give the model a stable structure
2. control the quality of execution inside that structure

That means a good prompt needs both:

- architecture
- execution doctrine

If you keep only the architecture, the result becomes clean but generic.
If you keep only the doctrine, the result becomes powerful but inconsistent.
The goal is to preserve both.

## The Two-Layer System

Every new prompt should be authored using these two layers:

### Layer 1: Core Structure

This is the stable skeleton every prompt should preserve.

1. `Role`
2. `Goal`
3. `Desired Audience Effect`
4. `Pull-Through Mechanism`
5. `Slide Structure`
6. `Caption`
7. `Rules`
8. `Output Format`
9. `Final Validation`

### Layer 2: Execution Doctrine

This is the missing meat. It controls how the prompt should actually behave.

A strong prompt usually needs guidance for:

- what makes the reader keep swiping
- what each slide must accomplish psychologically
- what counts as payoff
- what kind of specificity is mandatory
- what weak execution looks like
- what generic output patterns must be rejected

## Layer 1: Core Structure

### 1. Role

Tell the model what it is doing in one sentence.

Purpose:

- creates immediate task clarity
- prevents generic “content writer” behavior

Guidance:

- name the deliverable as a 6-slide Instagram carousel plus caption
- keep it short
- do not restate app-injected brand voice here

Example:

```text
You are creating a 6-slide Instagram carousel and caption from source material.
```

### 2. Goal

State what transformation the prompt should create in the output.

Purpose:

- defines what “good” means
- gives the whole prompt a center of gravity

Weak:

- write a carousel about X

Strong:

- turn X into a carousel that makes Y feel Z and understand A

### 3. Desired Audience Effect

State what the reader should feel, think, or become convinced of by the end.

Purpose:

- this is one of the highest-value layers in the historical prompts
- it controls slide progression better than topic framing alone

Examples:

- feel seen
- feel challenged
- feel unresolved curiosity
- feel smarter than before
- feel capable of doing this themselves
- feel compelled to act

Rule:

- this should be explicit in the prompt
- do not assume brand voice alone will carry it

### 4. Pull-Through Mechanism

Define why the reader keeps swiping.

Purpose:

- this is where weak prompts usually fail
- without this, the prompt becomes informational rather than compelling

Common mechanisms:

- unresolved curiosity
- emotional recognition
- belief collapse
- evidence reveal
- narrative investment
- confidence-building sequence

Example:

```text
The reader should keep swiping because each slide reduces confusion and increases confidence that this process is simpler and more doable than it first appeared.
```

### 5. Slide Structure

Define the job of each slide.

Purpose:

- gives the model a progression instead of six disconnected fragments
- this is the architectural heart of the prompt

Minimum requirement:

- each slide must have a distinct responsibility
- slides 1-2 should create or deepen pull
- slides 3-5 should deliver the payoff
- slide 6 should land the insight or CTA in an earned way

Important:

- do not stop at “what this slide is about”
- write what this slide must accomplish

### 6. Caption

Define what the caption should do relative to the slides.

Purpose:

- prevents repetition
- keeps the caption strategically useful

Common caption roles:

- deepen the lesson
- expand with practical context
- add value not included in slides
- reinforce the CTA
- create reflection

### 7. Rules

Define the non-negotiable constraints.

Purpose:

- prevents drift
- preserves formatting and style control

Examples:

- every slide under 250 characters
- caption under a set limit
- one idea per slide
- use newlines for readability
- never use `**`
- never use em dashes
- avoid fluff
- do not over-explain

Rule:

- include only the rules that should truly govern this prompt
- do not dump in irrelevant baggage

### 8. Output Format

This is mandatory in every prompt.

Required baseline:

```text
Slide 1:
[text]

Slide 2:
[text]

Slide 3:
[text]

Slide 4:
[text]

Slide 5:
[text]

Slide 6:
[text]

Caption:
[text]
```

Optional pre-output analytical sections are allowed only when they materially improve quality.

Examples:

- core message
- stance
- myth
- methodology
- hidden pattern
- moment

Default:

- keep it straight to output unless the prompt truly benefits from a pre-writing extraction step

### 9. Final Validation

Define the self-check before output.

Purpose:

- turns the prompt into instructions plus audit
- catches structural and quality failures before answer time

## Layer 2: Execution Doctrine

This is what the previous version of the skill lacked.

### A. Reader-State Progression

Every prompt should define what state the reader is in at each stage of the carousel.

Good prompts control the transition:

- slide 1: stop
- slide 2: invest
- slides 3-5: receive payoff
- slide 6: act, remember, or reframe

If the reader-state progression is unclear, the output will feel flat.

### B. Specificity Doctrine

Prompts should prefer:

- concrete over abstract
- observable over theoretical
- usable over impressive
- friction-language over jargon

Weak:

- explain the process in a helpful way

Strong:

- make the process feel less intimidating by naming where people get confused, stripping away unnecessary complexity, and turning the explanation into simple, actionable steps

### C. Payoff Doctrine

The prompt should define what “delivering” means.

Examples:

- if the hook promises clarity, slides 3-5 must reduce confusion
- if the hook promises evidence, slides 3-5 must deliver concrete proof
- if the hook promises a breakdown, slides 3-5 must make the workflow feel implementable

Rule:

- prompts should not just generate tension
- they must tell the model how to cash the tension out

### D. Anti-Generic Doctrine

Prompts should explicitly reject weak output patterns.

Examples of weak output:

- vague summary language
- generic “tips”
- business buzzwords
- filler explanations
- calling something practical without making it practical
- repeating the source rather than transforming it
- explaining the topic from too high a level to be useful

### E. Precision Doctrine

Prompts should specify the writing behavior the output should exhibit.

Examples:

- concise, not sparse
- direct, not robotic
- useful, not padded
- simplified, not oversimplified
- confident, not bloated

For tactical or technical prompts, this often means:

- reduce overwhelm
- increase clarity
- make the reader feel capable
- sequence the information so each slide makes the next one easier to absorb

### F. Validation Doctrine

Validation should not only check formatting.

Strong validation can also check:

- does slide 1 create real pull
- does slide 2 deepen relevance or tension
- do slides 3-5 actually deliver the promised value
- does the carousel reduce confusion instead of increasing it
- does the CTA feel earned
- is the caption adding new value rather than echoing the slides

## Canonical Variation Layer

The deeper system stays fixed. The main variation lives in the pull-through mechanism and slide jobs.

### Variation: Story

Use when the reader should keep swiping because a moment is unresolved.

Execution notes:

- slide 1 drops them into a real moment
- slides 2-3 build tension and turn
- slides 4-5 extract and apply the principle
- slide 6 lingers emotionally or lands a CTA

Weak version:

- backstory-heavy
- moral too early

### Variation: Mirror

Use when recognition is the engine.

Execution notes:

- slide 1 should feel “how do you know that about me”
- slide 2 names the cost of the pattern
- slide 3 reveals the root
- slide 4 releases shame
- slide 5 gives one intervention
- slide 6 lands as identity or permission

Weak version:

- vague emotional language
- too much therapy-sounding abstraction

### Variation: Hot Take

Use when tension comes from a strong position.

Execution notes:

- slide 1 states the claim cleanly
- slide 2 proves this is not a random opinion
- slide 3 reveals the deeper uncomfortable truth
- slide 4 treats opposition intelligently
- slide 5 translates the stance into a useful reframe
- slide 6 lands with a quotable line or CTA

Weak version:

- empty provocation
- no deeper payoff

### Variation: Myth Kill

Use when one wrong belief needs to be dismantled and replaced.

Execution notes:

- slide 1 names the old belief and destabilizes it
- slide 2 shows the cost of that belief
- slide 3 delivers the truth reveal
- slide 4 explains why the truth works
- slide 5 gives replacement behavior
- slide 6 locks in the new lens or CTA

Weak version:

- myth is named, but not actually disproven

### Variation: Curiosity Loop

Use when each slide should partially close one loop while opening another.

Execution notes:

- every slide should answer something and create a next question
- slides 3-5 must still deliver real value, not just more teasing

Weak version:

- hook stacking without payoff

### Variation: Methodology Breakdown

Use when the content teaches a process, system, or workflow.

Execution notes:

- slide 1 should make the reader believe there is a simpler path to understanding
- slide 2 should name the friction or confusion point they recognize
- slide 3 should introduce the simplifying lens
- slides 4-5 should turn the process into clear, repeatable movement
- slide 6 should land with confidence, summary, or CTA

This variation is especially important for technical or DIY content.

The desired result is not “the reader learned information.”

The desired result is:

- the reader feels less intimidated
- the process feels clearer
- the steps feel more doable
- the workflow feels implementable without fluff

Weak version:

- generic how-to tone
- too much commentary
- too much explanation before actionable clarity appears

### Variation: Ranked Review / Evidence

Use when the content depends on rankings, verdicts, comparison, or receipts.

Execution notes:

- slide 1 states or implies the verdict
- slide 2 raises the stakes
- slides 3-5 deliver evidence in a concrete sequence
- slide 6 gives the practical takeaway or CTA

Weak version:

- dramatic verdict with thin evidence

## What Stays Out Of The Canonical Base

These may appear in some historical prompts, but they are not part of the canonical architecture:

- long brand biographies
- detailed audience biographies
- offer descriptions
- account handles and credentials
- external CTA systems unless requested
- content-type constraints already handled elsewhere in system context
- repeated rules that say the same thing in multiple ways without adding control

These can be layered in later only if explicitly requested.

## Default Authoring Standard

When in doubt, optimize for:

- high quality
- structural discipline
- strong psychological pull
- real payoff
- useful specificity
- low fluff
- minimal redundancy

The prompt can be robust, but it should never feel hollow.

## Drafting Standard For This Skill

When creating one new prompt:

1. identify the prompt goal
2. identify the desired audience effect
3. identify the pull-through mechanism
4. choose or invent the archetype
5. map the slide-level jobs with real payoff logic
6. define the rules
7. enforce explicit output format
8. add validation that checks quality, not just format

## Final Output Standard

When the user asks for a new prompt using this system, the final response should normally be:

```text
Title: ...
Prompt: ...
```
