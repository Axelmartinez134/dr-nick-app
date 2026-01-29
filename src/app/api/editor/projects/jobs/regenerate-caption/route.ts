import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  projectId: string;
};

function sanitizeText(input: string): string {
  // Remove ASCII control chars that can break JSON payloads/logging,
  // but preserve common whitespace formatting (tabs/newlines).
  return String(input || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .trim();
}

function buildDefaultCaptionPrompt(): string {
  return `COMPLETE CONTEXT FOR CAROUSEL CAPTION GENERATION
ABOUT THE USER
Business Identity:

Name: Ax
Business: "The Bottleneck Hunter"
Website: AutomatedBots.com
Positioning: AI automation consultant who applies Theory of Constraints methodology from Fortune 500 auditing background
Target Market: Post-product-market-fit companies ($1M-$20M revenue, 1-60 employees)
Core Service: Identify operational constraints BEFORE implementing AI solutions

Current Business Status:

Current MRR: ~$3K
Goal: $10K MRR
Recently landed: $9K client
Experience: 1+ year implementing AI for businesses
Background: Former Fortune 500 auditor (quit January 2025)

Key Differentiators:

Uses Theory of Constraints (TOC) methodology
Emphasizes constraint identification BEFORE tool selection
References "The Goal" by Eliyahu Goldratt
NOT a generic "AI automation consultant" - strategic business diagnostician first, implementer second

Technical Expertise:

n8n workflow development
Airtable automation
Cold email infrastructure (32 accounts across 8 domains via Instantly.ai)
Video production workflow automation
Quality control systems
API integrations

Content Infrastructure:

Creating 40 carousels per month
Platforms: LinkedIn and Instagram
Focus: Educational content about business constraints and operational efficiency


COPYWRITING FRAMEWORK (MANDATORY)
Every LinkedIn caption must follow this structure:

Open with intrigue/question - Hook that makes people stop scrolling
Establish credibility - Reference experience, specific results, or expertise
Show concrete pain - Real numbers, specific scenarios, actual costs
Inject constraint/bottleneck methodology - Always bring it back to finding constraints FIRST
Differentiate from generic automation consultants - "Here's what most consultants won't tell you..."
Reinforce "Bottleneck Hunter" brand - Use constraint/bottleneck language
Always emphasize finding constraint FIRST - Before any tool or solution
Conversational but professional tone - Not academic, not salesy


BRAND VOICE & TONE
Do:

Sound like a strategic advisor, not a vendor
Use short, punchy sentences
Include specific numbers and concrete examples
Lead with business outcomes, not technical features
Reference Fortune 500 audit methodology when relevant
Mention Theory of Constraints concepts naturally
Use phrases like: "constraint," "bottleneck," "what's actually slowing you down"

Don't:

Use fear-based manipulation ("automate or die")
Sound like generic AI hype
Lead with tools before diagnosis
Use excessive emojis or caps
Write like a growth hacker
Be overly academic or jargon-heavy
Apologize or hedge unnecessarily


KEY POSITIONING PRINCIPLES
Core Message:
"Find your constraint first. THEN decide if AI helps."
Against:

Tool-first thinking
"Shiny object" automation
Fear-based urgency
Blind AI adoption

For:

Strategic diagnosis before implementation
Stable, proven tools over bleeding-edge
Automating actual bottlenecks, not random tasks
Business constraints drive technology decisions


CAROUSEL SERIES FRAMEWORKS
Current Series:

"Mental Models" - Business frameworks applied to operations

Format: "Mental Models #[number]: [Framework Name]"
Example: "Mental Models #1: The Lindy Effect"


"Constraint-First Automation" - TOC applied to AI/automation

Format: "Constraint-First Automation #[number]: [Topic]"
Example: "Constraint-First Automation #1: The AI Application Gap"



EXAMPLE CLIENT STORIES (Use for credibility)

Law Firm:

Before: Paralegals spent 15 hrs/week on contract review
After: AI handles initial review in 45 minutes
Result: Team focuses on client strategy instead of document scanning


Metabolic Coach (Dr. Nick):

Before: 10 hours every Monday on client fulfillment
After: Custom web app + automation cut time to 3 hours
Result: Focus on client satisfaction instead of remedial tasks



CONTENT FILTERS (What NOT to create)
Red Flags - Don't Create Content That:

Says "automate or get left behind" without mentioning constraints
Focuses on AI capabilities without business context
Uses pure fear-based urgency
Positions automation as always the answer
Discusses tools without mentioning diagnosis first
Sounds like every other AI automation consultant

Green Lights - Do Create Content About:

Finding constraints before solutions
Real client transformation stories
Mental models applied to business operations
Why most automation fails (wrong constraint)
Strategic tool selection methodology
Theory of Constraints applications


CAPTION LENGTH OPTIONS
Long-form (primary):

1,500-2,000 characters
Follows full 8-step framework
Includes concrete example
Ends with question or clear CTA

Short-form (alternative):

Under 500 characters
Distills key message
Still maintains constraint-first positioning
Quick hook + insight + CTA


STANDARD CTA
Primary CTA:
"Let's have a chat.
AutomatedBots.com"


TECHNICAL CONTEXT (For understanding)
His Automation Stack:

n8n (workflow automation)
Airtable (database/automation)
Instantly.ai (cold email infrastructure)
Google Sheets (data processing)
Various APIs and integrations

His Targets (Lead Gen):

Solar companies
Engineering services
Video production companies
Post-PMF B2B companies`;
}

async function callAnthropicCaption(opts: { systemPrompt: string; userMessage: string }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing env var: ANTHROPIC_API_KEY');

  // Keep consistent with other editor Claude calls (image prompts).
  const model = 'claude-sonnet-4-5-20250929';

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 45_000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2500,
        temperature: 0.7,
        messages: [{ role: 'user', content: `${opts.systemPrompt}\n\n${opts.userMessage}` }],
      }),
      signal: ac.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.error?.message || 'Anthropic API error';
      throw new Error(msg);
    }
    const text = String(json?.content?.[0]?.text || '');
    return { text, model };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
  const projectId = String(body?.projectId || '').trim();
  if (!projectId) return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });

  // Load project (caption + title) and ensure ownership via RLS + explicit filter.
  const { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .select('id, owner_user_id, title, caption')
    .eq('id', projectId)
    .eq('owner_user_id', user.id)
    .single();
  if (projectErr || !project) {
    return NextResponse.json({ success: false, error: projectErr?.message || 'Project not found' }, { status: 404 });
  }

  // Load all 6 slides (headline/body). (Regular can have null headline; normalize to empty string.)
  const { data: slides, error: slidesErr } = await supabase
    .from('carousel_project_slides')
    .select('slide_index, headline, body')
    .eq('project_id', projectId)
    .order('slide_index', { ascending: true });
  if (slidesErr || !slides || slides.length !== 6) {
    return NextResponse.json({ success: false, error: 'Could not load slides' }, { status: 500 });
  }

  // Load per-user prompt override (global).
  const { data: editorRow } = await supabase
    .from('editor_users')
    .select('caption_regen_prompt_override')
    .eq('user_id', user.id)
    .maybeSingle();
  const systemPromptRaw =
    String((editorRow as any)?.caption_regen_prompt_override || '').trim() || buildDefaultCaptionPrompt();
  const systemPrompt = sanitizeText(systemPromptRaw);

  // Load prior runs (all) to give "rejected attempts" context.
  const { data: priorRuns } = await supabase
    .from('carousel_caption_regen_runs')
    .select('output_caption, created_at')
    .eq('project_id', projectId)
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: true });
  const rejectedCaptions: string[] = (priorRuns || [])
    .map((r: any) => String(r?.output_caption || '').trim())
    .filter(Boolean);

  const slidesInput = slides
    .slice()
    .sort((a: any, b: any) => Number(a.slide_index) - Number(b.slide_index))
    .map((s: any, i: number) => ({
      slideNumber: i + 1,
      headline: String(s?.headline || ''),
      body: String(s?.body || ''),
    }));

  const currentCaption = String((project as any)?.caption || '');
  const title = String((project as any)?.title || '');

  const userMessage = [
    `You are writing a LinkedIn carousel caption for Ax ("The Bottleneck Hunter").`,
    ``,
    `HARD REQUIREMENTS:`,
    `- Use ONLY the information in the carousel context + the system prompt.`,
    `- Choose whatever length is appropriate for the context (no need to force long/short).`,
    `- No emojis. No excessive caps.`,
    `- End with the standard CTA exactly as provided in the system prompt.`,
    `- Return ONLY the final caption text (no markdown, no quotes, no preamble).`,
    ``,
    `CAROUSEL CONTEXT (JSON):`,
    JSON.stringify(
      {
        projectTitle: title,
        slides: slidesInput,
        currentCaption,
        rejectedCaptions,
      },
      null,
      2
    ),
    ``,
    rejectedCaptions.length
      ? `NOTE: The rejectedCaptions are previous attempts the user disliked. Do NOT repeat their structure or phrasing; produce a meaningfully different caption.`
      : `NOTE: No prior attempts exist. Produce the best caption you can.`,
  ].join('\n');

  const fullPromptSentToClaude = `${systemPrompt}\n\n${userMessage}`;

  try {
    const out = await callAnthropicCaption({ systemPrompt, userMessage });
    const caption = sanitizeText(out.text);
    if (!caption) throw new Error('Claude returned an empty caption');

    // Persist run history
    const inputContext = {
      projectTitle: title,
      slides: slidesInput,
      currentCaption,
      rejectedCaptions,
    };
    await supabase.from('carousel_caption_regen_runs').insert({
      owner_user_id: user.id,
      project_id: projectId,
      prompt_rendered: fullPromptSentToClaude,
      input_context: inputContext,
      output_caption: caption,
    });

    // Persist the caption onto the project
    await supabase
      .from('carousel_projects')
      .update({ caption })
      .eq('id', projectId)
      .eq('owner_user_id', user.id);

    return NextResponse.json({
      success: true,
      caption,
      debug: {
        promptSentToClaude: fullPromptSentToClaude,
        systemPrompt,
        model: out.model,
        priorAttempts: rejectedCaptions.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || 'Failed to regenerate caption' },
      { status: 500 }
    );
  }
}

