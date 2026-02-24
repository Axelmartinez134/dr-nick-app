import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getAuthedSupabase, resolveActiveAccountId } from "../../../_utils";
import { loadEffectiveTemplateTypeSettings } from "../../_effective";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  projectId: string;
  slideIndex: number;
  guidanceText?: string | null;
};

type InlineStyleRange = {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

function sanitizePrompt(input: string): string {
  return String(input || "").replace(/[\x00-\x1F\x7F]/g, " ").trim();
}

function extractJsonObject(text: string): any {
  const s = String(text || "");
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Parser did not return JSON");
  }
  const raw = s.slice(first, last + 1);
  return JSON.parse(raw);
}

function sanitizeInlineStyleRanges(text: string, ranges: any): InlineStyleRange[] {
  const s = String(text || "");
  const len = s.length;
  if (!Array.isArray(ranges) || len <= 0) return [];

  const isWordChar = (ch: string) => /[A-Za-z0-9'’]/.test(ch);
  const snapToWordBoundaries = (startIn: number, endIn: number): { start: number; end: number } => {
    let start = Math.max(0, Math.min(len, Math.floor(startIn)));
    let end = Math.max(0, Math.min(len, Math.floor(endIn)));
    if (end <= start) return { start, end };

    while (start < end && /\s/.test(s[start]!)) start++;
    while (start < end && /\s/.test(s[end - 1]!)) end--;
    if (end <= start) return { start, end };

    while (start > 0 && isWordChar(s[start - 1]!) && isWordChar(s[start]!)) start--;
    while (end < len && isWordChar(s[end - 1]!) && isWordChar(s[end]!)) end++;

    while (start < end && /\s/.test(s[start]!)) start++;
    while (start < end && /\s/.test(s[end - 1]!)) end--;
    return { start, end };
  };

  const out: InlineStyleRange[] = [];
  for (const r of ranges) {
    const start = Number((r as any)?.start);
    const end = Number((r as any)?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (start < 0 || end > len || start >= end) continue;
    const snapped = snapToWordBoundaries(start, end);
    if (snapped.end <= snapped.start) continue;
    const next: InlineStyleRange = { start: snapped.start, end: snapped.end };
    if ((r as any)?.bold) next.bold = true;
    if ((r as any)?.italic) next.italic = true;
    if ((r as any)?.underline) next.underline = true;
    if (!next.bold && !next.italic && !next.underline) continue;
    out.push(next);
  }
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  return out;
}

async function callAnthropicEmphasisRanges(opts: { slideTexts: string[]; instructionText: string }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing env var: ANTHROPIC_API_KEY");

  // Match the emphasis model used by Generate Copy / Body Regenerate.
  const model = "claude-sonnet-4-5-20250929";

  const texts = (opts.slideTexts || []).map((b) => String(b || ""));
  if (texts.length !== 6) throw new Error("Emphasis input must include exactly 6 slide texts");

  const instructionText = String(opts.instructionText || "");
  const slidesJson = JSON.stringify(texts.map((t, i) => ({ index: i, text: t })));

  const prompt = `${instructionText}

INPUT (JSON):
You are given EXACT slide text. Ranges must be relative to the slide's "text" field ONLY.
Do NOT count JSON syntax or the index number as part of the text.

SLIDES_JSON:
${slidesJson}

OUTPUT:
Return ONLY valid JSON (no markdown):
{
  "slides": [
    { "index": 0, "ranges": [ { "start": 0, "end": 10, "bold": true }, { "start": 15, "end": 22, "italic": true }, { "start": 30, "end": 40, "underline": true } ] }
  ]
}

RANGE RULES (HARD):
- Do NOT change any characters.
- Do NOT add/remove slides.
- Use half-open ranges [start,end)
- 0 <= start < end <= text.length
- Start/end MUST align to word/phrase boundaries (never split a word).
- Do not include leading/trailing whitespace in ranges.
- Prefer complete words/phrases; never punctuation/whitespace.
- Less is more; do not emphasize everything.`;

  try {
    console.log("[BodyEmphasis][Emphasis] 🧪 Full prompt sent to Claude (stringified):");
    console.log(JSON.stringify(prompt));
  } catch {
    // ignore
  }

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 45_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: ac.signal,
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.error?.message || JSON.stringify(json)?.slice(0, 500) || "Unknown Anthropic error";
      throw new Error(`Anthropic emphasis error (${res.status}): ${msg}`);
    }
    const content0 = json?.content?.[0];
    const text = content0?.text || "";
    const payload = extractJsonObject(text);

    const out: InlineStyleRange[][] = Array.from({ length: 6 }, () => []);
    const slides = Array.isArray(payload?.slides) ? payload.slides : [];
    for (const entry of slides) {
      const index = Number((entry as any)?.index);
      if (!Number.isFinite(index) || index < 0 || index > 5) continue;
      out[index] = sanitizeInlineStyleRanges(texts[index] || "", (entry as any)?.ranges);
    }
    return { rangesBySlide: out, model };
  } finally {
    clearTimeout(t);
  }
}

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const projectId = String(body?.projectId || "").trim();
  const slideIndex = Number(body?.slideIndex);
  const guidanceText = body?.guidanceText === undefined || body?.guidanceText === null ? null : String(body.guidanceText);

  if (!projectId) return NextResponse.json({ success: false, error: "projectId is required" }, { status: 400 });
  if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 5) {
    return NextResponse.json({ success: false, error: "slideIndex must be 0..5" }, { status: 400 });
  }

  // Load project (account-scoped)
  const { data: project, error: projectErr } = await supabase
    .from("carousel_projects")
    .select("id, template_type_id")
    .eq("id", projectId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (projectErr || !project) {
    return NextResponse.json({ success: false, error: projectErr?.message || "Project not found" }, { status: 404 });
  }

  const templateTypeId = String((project as any)?.template_type_id || "") === "enhanced" ? "enhanced" : "regular";
  if (templateTypeId !== "regular") {
    return NextResponse.json({ success: false, error: "Regenerate Emphasis Styles is only available for Regular projects" }, { status: 400 });
  }

  // Load all 6 slide bodies (copy must remain unchanged; we only compute ranges).
  const { data: slides, error: slidesErr } = await supabase
    .from("carousel_project_slides")
    .select("slide_index, body")
    .eq("project_id", projectId)
    .order("slide_index", { ascending: true });
  if (slidesErr || !slides || slides.length !== 6) {
    return NextResponse.json({ success: false, error: "Could not load slides" }, { status: 500 });
  }

  const bodies = slides
    .slice()
    .sort((a: any, b: any) => Number(a.slide_index) - Number(b.slide_index))
    .map((s: any) => String(s?.body || ""));
  const currentBody = bodies[slideIndex] || "";

  // Effective template-type emphasis instruction (Regular).
  const { effective } = await loadEffectiveTemplateTypeSettings(supabase, { accountId, actorUserId: user.id }, "regular");
  const emphasisInstructionBase = sanitizePrompt(String((effective as any)?.emphasisPrompt || ""));
  if (!emphasisInstructionBase) {
    return NextResponse.json({ success: false, error: "Missing Text Styling prompt for Regular template type." }, { status: 400 });
  }

  const guidance = guidanceText && String(guidanceText).trim() ? sanitizePrompt(String(guidanceText)) : "";
  const emphasisInstruction = guidance
    ? `${emphasisInstructionBase}\n\nUSER FEEDBACK (apply to styling only; do not change text):\n${guidance}`
    : emphasisInstructionBase;

  try {
    const out = await callAnthropicEmphasisRanges({ slideTexts: bodies, instructionText: emphasisInstruction });
    const nextRanges = out.rangesBySlide?.[slideIndex] || [];

    const inputContext = {
      projectId,
      slideIndex,
      currentBody,
      guidanceText: guidanceText ? String(guidanceText) : "",
    };

    await supabase.from("carousel_body_emphasis_attempts").insert({
      account_id: accountId,
      owner_user_id: user.id,
      project_id: projectId,
      slide_index: slideIndex,
      guidance_text: guidanceText && String(guidanceText).trim() ? String(guidanceText) : null,
      prompt_rendered: emphasisInstruction,
      input_context: inputContext,
      output_body: currentBody,
      output_body_style_ranges: nextRanges,
    });

    return NextResponse.json({
      success: true,
      bodyStyleRanges: nextRanges,
      debug: { model: out.model },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Failed to regenerate emphasis styles" }, { status: 500 });
  }
}

