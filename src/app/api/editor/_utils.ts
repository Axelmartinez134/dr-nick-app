import 'server-only';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1] || null;
}

export function getSupabaseWithToken(token: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Supabase environment variables not configured');
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function getAuthedSupabase(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return { ok: false as const, status: 401 as const, error: 'Unauthorized' };
  const supabase = getSupabaseWithToken(token);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false as const, status: 401 as const, error: 'Unauthorized' };
  return { ok: true as const, supabase, user, token };
}

export type TemplateTypeId = 'regular' | 'enhanced';

export type TemplateTypeDefaultsRow = {
  id: TemplateTypeId;
  label: string;
  default_prompt: string;
  default_emphasis_prompt: string;
  default_image_gen_prompt: string;
  default_slide1_template_id: string | null;
  default_slide2_5_template_id: string | null;
  default_slide6_template_id: string | null;
  updated_at: string;
  updated_by: string | null;
};

const DEFAULT_EMPHASIS_PROMPT_REGULAR = `You are a social-media typography editor for a 6-slide carousel.

GOAL:
Make the text instantly scannable for someone scrolling fast. Use your discernment to apply emphasis so the reader understands the key takeaway in 1–2 seconds.

WHAT YOU CAN DO:
Return inline style ranges using bold / italic / underline.

WHAT YOU MUST NOT DO (hard rules):
- Do NOT change any characters in the text (no edits, no punctuation changes, no extra spaces, no rewording).
- Do NOT add or remove slides.
- Do NOT emphasize everything. Less is more.
- Avoid emphasizing stopwords and filler ("the", "and", "that", "really", etc.).
- Do NOT create overlapping ranges that fight each other.

WHEN TO USE EACH STYLE (use judgment):
- Bold: key nouns/terms and the core takeaway words that drive comprehension.
- Italic: contrast operators ("not", "but", "instead") to sharpen meaning.
- Underline: use sparingly, only if one short phrase is the single most "scroll-stopping" takeaway.

PLACEMENT (to avoid randomness):
- Emphasis should typically land on words that change meaning or carry the takeaway.
- Prefer complete words/phrases (no mid-word emphasis).
- Don’t emphasize punctuation or whitespace.`;

const DEFAULT_IMAGE_GEN_PROMPT = `You are creating image generation prompts for a 6-slide Instagram carousel about health/medical topics.

For EACH slide, generate a concise, descriptive prompt that would create a professional medical illustration matching that slide's content.

REQUIREMENTS:
- NO TEXT in the images (text will be added separately by the design system)
- Professional, clean medical illustration style
- Suitable for Instagram/LinkedIn carousel (portrait format 1080x1440)
- Educational and trustworthy visual aesthetic
- Consider the narrative flow across all 6 slides

INPUT: You will receive all 6 slides with their headline and body text.

OUTPUT: Return ONLY valid JSON:
{
  "prompts": [
    "prompt for slide 1",
    "prompt for slide 2", 
    "prompt for slide 3",
    "prompt for slide 4",
    "prompt for slide 5",
    "prompt for slide 6"
  ]
}

Each prompt should be 1-3 sentences describing the visual concept.`;

const DEFAULT_EMPHASIS_PROMPT_ENHANCED = `You are a social-media typography editor for a 6-slide carousel.

GOAL:
Make the headline + body instantly scannable for someone scrolling fast. Use your discernment to apply emphasis so the reader understands the key takeaway in 1–2 seconds.

WHAT YOU CAN DO:
Return inline style ranges using bold / italic / underline.

WHAT YOU MUST NOT DO (hard rules):
- Do NOT change any characters in the text (no edits, no punctuation changes, no extra spaces, no rewording).
- Do NOT add or remove slides.
- Do NOT emphasize everything. Less is more.
- Avoid emphasizing stopwords and filler ("the", "and", "that", "really", etc.).
- Do NOT create overlapping ranges that fight each other.

WHEN TO USE EACH STYLE (use judgment):
- Bold: key nouns/terms and the core takeaway words that drive comprehension.
- Italic: contrast operators ("not", "but", "instead") to sharpen meaning.
- Underline: use sparingly, only if one short phrase is the single most "scroll-stopping" takeaway.

PLACEMENT (to avoid randomness):
- Emphasis should typically land on words that change meaning or carry the takeaway.
- Prefer complete words/phrases (no mid-word emphasis).
- Don’t emphasize punctuation or whitespace.`;

export type TemplateTypeOverrideRow = {
  user_id: string;
  template_type_id: TemplateTypeId;
  prompt_override: string | null;
  emphasis_prompt_override: string | null;
  image_gen_prompt_override: string | null;
  slide1_template_id_override: string | null;
  slide2_5_template_id_override: string | null;
  slide6_template_id_override: string | null;
  updated_at: string;
};

export function mergeTemplateTypeDefaults(
  defaults: TemplateTypeDefaultsRow,
  override: TemplateTypeOverrideRow | null
) {
  return {
    templateTypeId: defaults.id,
    label: defaults.label,
    prompt: (override?.prompt_override ?? '') || defaults.default_prompt || '',
    emphasisPrompt:
      (String(override?.emphasis_prompt_override ?? '').trim() ||
        (defaults.default_emphasis_prompt || '').trim()) ||
      (defaults.id === 'enhanced' ? DEFAULT_EMPHASIS_PROMPT_ENHANCED : DEFAULT_EMPHASIS_PROMPT_REGULAR),
    imageGenPrompt:
      (String(override?.image_gen_prompt_override ?? '').trim() ||
        (defaults.default_image_gen_prompt || '').trim()) ||
      DEFAULT_IMAGE_GEN_PROMPT,
    slide1TemplateId: override?.slide1_template_id_override ?? defaults.default_slide1_template_id ?? null,
    slide2to5TemplateId: override?.slide2_5_template_id_override ?? defaults.default_slide2_5_template_id ?? null,
    slide6TemplateId: override?.slide6_template_id_override ?? defaults.default_slide6_template_id ?? null,
    updatedAt: defaults.updated_at,
  };
}

export { DEFAULT_IMAGE_GEN_PROMPT };


