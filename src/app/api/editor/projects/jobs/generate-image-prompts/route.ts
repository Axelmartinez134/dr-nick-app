import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, DEFAULT_IMAGE_GEN_PROMPT } from '../../../_utils';
import { loadEffectiveTemplateTypeSettings } from '../../_effective';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  projectId: string;
  slideIndex?: number; // Optional: if provided, regenerate only this slide
};

function extractJsonObject(text: string): any {
  const s = String(text || '');
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('Claude did not return valid JSON');
  }
  return JSON.parse(s.slice(first, last + 1));
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

  if (!body.projectId) {
    return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });
  }

  // Load project to get template_type_id
  const { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .select('id, owner_user_id, template_type_id')
    .eq('id', body.projectId)
    .eq('owner_user_id', user.id)
    .single();

  if (projectErr || !project) {
    return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
  }

  // Only for Enhanced template type
  if (project.template_type_id !== 'enhanced') {
    return NextResponse.json({ success: false, error: 'Image prompts only available for Enhanced template type' }, { status: 400 });
  }

  // Load all 6 slides
  const { data: slides, error: slidesErr } = await supabase
    .from('carousel_project_slides')
    .select('slide_index, headline, body')
    .eq('project_id', body.projectId)
    .order('slide_index', { ascending: true });

  if (slidesErr || !slides || slides.length !== 6) {
    return NextResponse.json({ success: false, error: 'Could not load slides' }, { status: 500 });
  }

  // Load the per-user effective image gen prompt for Enhanced
  const { effective: ttEffective } = await loadEffectiveTemplateTypeSettings(supabase, user.id, 'enhanced');
  const systemPrompt = String(ttEffective?.imageGenPrompt || '').trim() || DEFAULT_IMAGE_GEN_PROMPT;

  // Build the input for Claude
  const slidesInput = slides.map((s, i) => ({
    slideNumber: i + 1,
    headline: s.headline || '',
    body: s.body || '',
  }));

  const userMessage = `Here are the 6 slides:\n\n${JSON.stringify(slidesInput, null, 2)}`;
  const fullPromptSentToClaude = `${systemPrompt}\n\n${userMessage}`;

  // Call Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'Missing ANTHROPIC_API_KEY' }, { status: 500 });
  }

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 45_000);

  try {
    console.log('[Generate Image Prompts] 🤖 Calling Claude...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        temperature: 0.7,
        messages: [
          { role: 'user', content: `${systemPrompt}\n\n${userMessage}` },
        ],
      }),
      signal: ac.signal,
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const msg = json?.error?.message || 'Anthropic API error';
      throw new Error(msg);
    }

    const content = json?.content?.[0]?.text || '';
    const parsed = extractJsonObject(content);
    const prompts = parsed?.prompts;

    if (!Array.isArray(prompts) || prompts.length !== 6) {
      throw new Error('Claude did not return 6 prompts');
    }

    console.log('[Generate Image Prompts] ✅ Generated 6 prompts');

    // If slideIndex provided, only update that slide
    if (typeof body.slideIndex === 'number' && body.slideIndex >= 0 && body.slideIndex <= 5) {
      await supabase
        .from('carousel_project_slides')
        .update({ ai_image_prompt: prompts[body.slideIndex] })
        .eq('project_id', body.projectId)
        .eq('slide_index', body.slideIndex);

      return NextResponse.json({
        success: true,
        prompts: prompts,
        updatedSlideIndex: body.slideIndex,
        debug: {
          // Debug only: show EXACT prompt sent to Claude (no API keys).
          // Returned so /editor Debug panel can copy/paste it.
          promptSentToClaude: fullPromptSentToClaude,
          systemPrompt,
        },
      });
    }

    // Otherwise update all 6 slides
    await Promise.all(
      prompts.map((prompt: string, idx: number) =>
        supabase
          .from('carousel_project_slides')
          .update({ ai_image_prompt: prompt })
          .eq('project_id', body.projectId)
          .eq('slide_index', idx)
      )
    );

    return NextResponse.json({
      success: true,
      prompts,
      debug: {
        promptSentToClaude: fullPromptSentToClaude,
        systemPrompt,
      },
    });
  } catch (e: any) {
    console.error('[Generate Image Prompts] ❌ Failed:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Failed to generate image prompts' }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
