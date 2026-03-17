import 'server-only';

export function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

export function sanitizeText(input: string): string {
  return String(input || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ').trim();
}

export function sanitizePrompt(input: string): string {
  return String(input || '').replace(/[\x00-\x1F\x7F]/g, ' ').trim();
}

export type BodyRegenAttemptContext = {
  createdAt: string;
  guidanceText: string;
  body: string;
};

export type BodyRegenSlideContext = {
  slideIndex: number;
  textLines: string;
};

export type BodyRegenSourceContext = {
  caption: string;
  transcript: string;
} | null;

export type BodyRegenContext = {
  project: {
    id: string;
    title: string;
    caption: string;
  };
  brandVoice: string;
  slidesText: BodyRegenSlideContext[];
  attempts: BodyRegenAttemptContext[];
  swipeSource: BodyRegenSourceContext;
};

export async function loadBodyRegenContextOrThrow(args: {
  supabase: any;
  accountId: string;
  projectId: string;
  slideIndex: number;
}): Promise<BodyRegenContext> {
  const { supabase, accountId, projectId, slideIndex } = args;

  const { data: project, error: projErr } = await supabase
    .from('carousel_projects')
    .select('id, caption, title, source_swipe_item_id')
    .eq('account_id', accountId)
    .eq('id', projectId)
    .is('archived_at', null)
    .maybeSingle();
  if (projErr) throw new Error(projErr.message);
  if (!project?.id) throw new Error('Project not found');

  const { data: slides, error: slidesErr } = await supabase
    .from('carousel_project_slides')
    .select('slide_index, layout_snapshot')
    .eq('project_id', projectId)
    .order('slide_index', { ascending: true });
  if (slidesErr) throw new Error(slidesErr.message);
  if (!Array.isArray(slides) || slides.length !== 6) throw new Error('Could not load slides');

  for (const r of slides as any[]) {
    const snap = r?.layout_snapshot;
    const lines = snap && typeof snap === 'object' ? (snap as any).textLines : null;
    if (!Array.isArray(lines)) throw new Error('Generate/Realign first.');
  }

  const { data: settingsRow, error: settingsErr } = await supabase
    .from('editor_account_settings')
    .select('brand_alignment_prompt_override')
    .eq('account_id', accountId)
    .maybeSingle();
  if (settingsErr) throw new Error(settingsErr.message);

  const brandVoice = String((settingsRow as any)?.brand_alignment_prompt_override ?? '');

  const slidesText = (slides as any[])
    .slice()
    .sort((a: any, b: any) => Number(a?.slide_index) - Number(b?.slide_index))
    .map((r: any, idx: number) => {
      const si = Number.isFinite(r?.slide_index) ? Number(r.slide_index) : idx;
      const snap = r?.layout_snapshot || {};
      const lines = Array.isArray((snap as any)?.textLines) ? ((snap as any).textLines as any[]) : [];
      const joined = lines.map((l) => String(l?.text ?? '')).filter(Boolean).join('\n');
      return { slideIndex: si, textLines: joined || '(no text lines)' };
    });

  const { data: priorRuns } = await supabase
    .from('carousel_body_regen_attempts')
    .select('created_at, guidance_text, output_body')
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .eq('slide_index', slideIndex)
    .order('created_at', { ascending: false })
    .limit(20);

  const attempts = (Array.isArray(priorRuns) ? (priorRuns as any[]) : []).map((r) => ({
    createdAt: String(r?.created_at || ''),
    guidanceText: String(r?.guidance_text || ''),
    body: String(r?.output_body || ''),
  }));

  const swipeItemId = String((project as any)?.source_swipe_item_id || '').trim();
  let swipeSource: BodyRegenSourceContext = null;
  if (swipeItemId) {
    const { data: swipeRow, error: swipeErr } = await supabase
      .from('swipe_file_items')
      .select('caption, transcript')
      .eq('account_id', accountId)
      .eq('id', swipeItemId)
      .maybeSingle();
    if (swipeErr) throw new Error(swipeErr.message);
    if (swipeRow) {
      swipeSource = {
        caption: String((swipeRow as any)?.caption || ''),
        transcript: String((swipeRow as any)?.transcript || ''),
      };
    }
  }

  return {
    project: {
      id: String((project as any).id),
      title: String((project as any).title || ''),
      caption: String((project as any).caption || ''),
    },
    brandVoice,
    slidesText,
    attempts,
    swipeSource,
  };
}

export async function loadBodyRegenMasterPrompt(args: { supabase: any; accountId: string }) {
  const { supabase, accountId } = args;
  const { data: settingsRow } = await supabase
    .from('editor_account_settings')
    .select('swipe_ideas_master_prompt_override')
    .eq('account_id', accountId)
    .maybeSingle();
  return String((settingsRow as any)?.swipe_ideas_master_prompt_override ?? '').trim() || 'You are a helpful copywriting assistant.';
}

export function buildBodyRegenSystemText(args: { masterPrompt: string; slideIndex: number }) {
  return sanitizePrompt(
    [
      `MASTER_PROMPT:\n${args.masterPrompt}`,
      ``,
      `TARGET: You are rewriting BODY text for SLIDE ${args.slideIndex + 1} only.`,
      `OUTPUT FORMAT (HARD): Return ONLY valid JSON (no markdown, no preamble):`,
      `{`,
      `  "assistantMessage": "string",`,
      `  "candidates": [`,
      `    { "body": "string" },`,
      `    { "body": "string" },`,
      `    { "body": "string" }`,
      `  ]`,
      `}`,
      ``,
      `RULES (HARD):`,
      `- candidates must be exactly 3.`,
      `- Each candidate.body must be plain text only (no markdown, no quotes around the whole body).`,
      `- Keep each candidate consistent with the rest of the carousel context.`,
      `- If the user asks for changes, adapt the next three options accordingly.`,
    ].join('\n')
  );
}

export function buildBodyRegenContextText(args: {
  brandVoice: string;
  projectTitle: string;
  caption: string;
  slidesText: BodyRegenSlideContext[];
  attempts: BodyRegenAttemptContext[];
  swipeSource: BodyRegenSourceContext;
}) {
  const attemptsBlock = args.attempts.length
    ? args.attempts
        .slice()
        .reverse()
        .map((a, i) => {
          const when = a.createdAt ? ` (${a.createdAt})` : '';
          const g = a.guidanceText ? `Guidance: ${a.guidanceText}` : 'Guidance: (none)';
          return `ATTEMPT ${i + 1}${when}\n${g}\nBODY:\n${a.body}`;
        })
        .join('\n\n')
    : '(none)';

  const slidesBlock = args.slidesText
    .slice()
    .sort((a, b) => a.slideIndex - b.slideIndex)
    .map((s) => `SLIDE ${s.slideIndex + 1} (textLines):\n${s.textLines}`)
    .join('\n\n');

  const swipeBlocks: string[] = [];
  if (args.swipeSource) {
    swipeBlocks.push(`SWIPE_SOURCE_CAPTION:\n${args.swipeSource.caption || '-'}`);
    swipeBlocks.push(`SWIPE_SOURCE_TRANSCRIPT:\n${args.swipeSource.transcript || '-'}`);
  }

  return sanitizePrompt(
    [
      `BRAND_VOICE:\n${args.brandVoice || '-'}`,
      ``,
      `PROJECT_TITLE:\n${args.projectTitle || '-'}`,
      ``,
      `CAROUSEL_TEXTLINES:\n${slidesBlock || '-'}`,
      ``,
      `CAPTION:\n${args.caption || '-'}`,
      ``,
      ...swipeBlocks.flatMap((block) => [block, ``]),
      `PREVIOUS_BODY_ATTEMPTS (for this slide; avoid repeating them):\n${attemptsBlock}`,
    ].join('\n')
  );
}

export function formatBodyRegenHistoryText(history: Array<{ role: 'user' | 'assistant'; content: string }>) {
  if (!Array.isArray(history) || history.length === 0) return '(none)';
  return history
    .map((entry) => `${entry.role === 'assistant' ? 'ASSISTANT' : 'USER'}:\n${String(entry.content || '').trim() || '-'}`)
    .join('\n\n');
}
