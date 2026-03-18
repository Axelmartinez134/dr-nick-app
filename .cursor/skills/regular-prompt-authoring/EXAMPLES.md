# Usage Pattern And Examples

This file shows how to use the `regular-prompt-authoring` skill in practice.

## Recommended User Prompt

Use a natural request like:

```text
Help me create a new regular saved prompt for this audience effect.
Use the regular prompt authoring skill, read the architecture, ask me all needed questions in one batch, then draft the title and prompt.
```

## Slightly More Directed Version

```text
Help me create a new regular saved prompt for this audience effect:
[describe effect]

Use the in-repo prompt authoring instructions, synthesize patterns from the architecture, ask your follow-up questions in one batch, and then draft the final title and prompt.
```

## Expected Assistant Flow

1. Read the skill.
2. Read the architecture.
3. Ask one batched clarification pass if needed.
4. Draft one new prompt.
5. Return only:

```text
Title: ...
Prompt: ...
```

## Example Clarification Pass

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

## Example Final Output

```text
Title: The Do-It-Yourself Breakdown
Prompt: You are creating a 6-slide Instagram carousel and caption from source material.

Goal:
Turn the source into a carousel that makes a technical process feel understandable, achievable, and worth implementing without making it feel watered down.

Desired Audience Effect:
The reader should feel less intimidated, more oriented inside the process, and more convinced that they can actually do this themselves.

Pull-Through Mechanism:
The reader should keep swiping because each slide removes one layer of confusion and replaces it with a clearer, more usable mental model. The carousel should feel like it is de-mystifying something that normally feels more technical than it needs to be.

Slide Structure:
Slide 1: Open with a hook that frames the technical task as more doable than the reader assumes. The slide should stop the scroll by challenging the feeling that this is too complex, too technical, or only for experts.
Slide 2: Name the exact part that usually creates friction or overwhelm. The reader should feel understood here... like the prompt knows where people usually get lost and why they stall out.
Slide 3: Deliver the simplifying lens. This slide should explain the process in a way that lowers the reader's cognitive load and makes the rest of the workflow feel more manageable.
Slide 4: Break the process into a clean sequence, framework, or repeatable movement. This slide should make the workflow feel organized instead of messy.
Slide 5: Show the practical payoff. The reader should now feel capable of starting, fixing, or implementing the process themselves. Include useful guidance, common mistakes, or execution cues that make the content feel actionable rather than theoretical.
Slide 6: End with a clear CTA to comment for more resources. Keep the resource intentionally vague so it can be customized later, but make the CTA feel earned by the value delivered on slides 3 through 5.

Caption:
Expand the lesson with additional practical context, useful tips, or clarifying guidance that did not fit in the slides. Do not repeat the carousel line for line. The caption should reinforce that this is doable, summarize the key action takeaway, and end by restating the CTA to comment for more resources.

Rules:
Every slide must stay under 250 characters.
The caption must stay under 900 characters.
Use newlines for readability.
Never use **.
Never use em dashes.
One idea per slide.
Keep the writing concise and direct.
Do not over-explain.
Do not use fluff words.
Do not hide the useful part behind long setup.
Do not describe something as simple unless the slide actually makes it feel simple.
Use concrete language over abstract business jargon.
Prioritize clarity and confidence over sounding impressive.

Output Format:
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

Final Validation:
Check that each slide performs its assigned role.
Check that slide 1 creates real pull instead of just naming the topic.
Check that slide 2 identifies the real friction point rather than vaguely saying the process is hard.
Check that slide 3 actually lowers confusion.
Check that slides 4 and 5 deliver usable clarity, not commentary about clarity.
Check that no slide breaks the character limit.
Check that the carousel makes the process feel more doable by slide 5.
Check that the caption adds practical value instead of repeating slide copy.
Check that the language stays direct, concrete, and free of fluff.
Check that slide 6 includes the comment CTA without specifying the resource.
Check that the output follows the exact format above.
```

## Notes

- The architecture should be synthesized, not copied from one legacy prompt.
- The final prompt can be robust, but it should remain structurally disciplined.
- If the user wants a new archetype, preserve the canonical section order and only change the slide engine.
- A good authored prompt should feel like a behavior-control spec, not a cleaned-up worksheet.
