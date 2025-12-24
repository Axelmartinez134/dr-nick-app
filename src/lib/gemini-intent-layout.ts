import 'server-only';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LayoutIntent, SafeZone } from './layout-engine';

export type EmphasisLineStyles = Array<{ start: number; end: number; fontWeight?: string; fontStyle?: string }>;

export async function getEmphasisStylesForLines(
  lines: Array<{ text: string }>,
  options?: {
    timeoutMs?: number;
    maxAttempts?: number;
    logFullPrompt?: boolean;
  }
): Promise<EmphasisLineStyles[]> {
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error('Google AI API key is not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.4,
      topP: 0.95,
      topK: 40,
    },
  });

  const timeoutMs = options?.timeoutMs ?? 25_000;
  const maxAttempts = options?.maxAttempts ?? 1;

  const withTimeout = async <T,>(p: Promise<T>, label: string): Promise<T> => {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  };

  const numberedLines = lines.map((l, i) => `${i}: ${l.text}`).join('\n');
  const prompt = `You are a typography assistant.

TASK: Add emphasis (bold/italic) to existing text lines for a social media carousel.

RULES:
- DO NOT change any characters in the text.
- You MUST NOT add or remove lines.
- Only return character style ranges for each line.
- Prefer bolding 1-3 important medical/scientific terms, numbers, or outcomes per line.
- Ranges must be within the string bounds: 0 <= start < end <= text.length
- Use half-open ranges [start,end)

LINES:
${numberedLines}

Return ONLY valid JSON (no markdown):
{
  "lines": [
    { "index": 0, "styles": [ { "start": 0, "end": 10, "fontWeight": "bold" } ] }
  ]
}`;

  console.log('[Gemini Styles] ✨ Requesting emphasis styles...');
  console.log('[Gemini Styles] 📄 Lines:', lines.length);
  console.log('[Gemini Styles] 📝 Prompt preview:', prompt.substring(0, 400) + '...');
  if (options?.logFullPrompt || process.env.LOG_GEMINI_PROMPT === 'true') {
    console.log('[Gemini Styles] 🧾 FULL PROMPT START');
    console.log(prompt);
    console.log('[Gemini Styles] 🧾 FULL PROMPT END');
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await withTimeout(
        model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        } as any),
        'Gemini generateContent'
      );
      const response = await withTimeout(result.response, 'Gemini response');
      const text = response.text();

      let cleaned = text.trim();
      cleaned = cleaned.replace(/^```json\n?/gm, '').replace(/^```\n?/gm, '').replace(/```$/gm, '');
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];

      const parsed = JSON.parse(cleaned) as { lines: Array<{ index: number; styles: EmphasisLineStyles }> };
      const out: EmphasisLineStyles[] = Array.from({ length: lines.length }, () => []);

      for (const entry of parsed.lines || []) {
        if (typeof entry.index !== 'number' || entry.index < 0 || entry.index >= lines.length) continue;
        const textLen = lines[entry.index].text.length;
        const safeStyles: EmphasisLineStyles = [];
        for (const s of entry.styles || []) {
          const start = Number((s as any).start);
          const end = Number((s as any).end);
          if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
          if (start < 0 || end > textLen || start >= end) continue;
          safeStyles.push({
            start,
            end,
            fontWeight: (s as any).fontWeight,
            fontStyle: (s as any).fontStyle,
          });
        }
        out[entry.index] = safeStyles;
      }

      console.log('[Gemini Styles] ✅ Styles parsed');
      return out;
    } catch (e) {
      console.warn(`[Gemini Styles] ❌ Attempt ${attempt} failed:`, e);
      if (attempt >= maxAttempts) throw e;
    }
  }

  return Array.from({ length: lines.length }, () => []);
}

/**
 * GEMINI INTENT-BASED LAYOUT
 * 
 * The AI never sees global canvas coordinates or the word "540".
 * It only sees a "Safe Box" and returns Flexbox-style intent.
 * 
 * This removes the "centering bias" by removing the poison from the input.
 */

export async function getLayoutIntent(
  headline: string,
  body: string,
  safeZone: SafeZone,
  options?: {
    mode?: 'normal' | 'tight';
    maxTotalLines?: number;
    maxAttempts?: number;
    timeoutMs?: number;
    logFullPrompt?: boolean;
  }
): Promise<LayoutIntent> {
  console.log('[Gemini Intent] 🎨 Starting intent-based layout...');
  console.log('[Gemini Intent] 📦 Safe Zone:', safeZone.id, `${safeZone.width}x${safeZone.height}px`);
  console.log('[Gemini Intent] 📝 Headline:', headline.substring(0, 50));
  console.log('[Gemini Intent] 📝 Body:', body.substring(0, 50));
  console.log('[Gemini Intent] ⚙️ Options:', options || {});

  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error('[Gemini Intent] ❌ GOOGLE_AI_API_KEY is not configured');
    throw new Error('Google AI API key is not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.3, // LOW TEMPERATURE - We want deterministic intent selection
      topP: 0.95,
      topK: 40,
    },
  });

  // Calculate character limits based on zone width and font sizes
  // These are approximate - used to hint to Gemini when to break lines
  const isNarrowZone = safeZone.width < 500;
  const charLimitHeadline = Math.floor(safeZone.width / (isNarrowZone ? 45 : 40)); // ~40-45px per char for 72-84px font
  const charLimitBody = Math.floor(safeZone.width / (isNarrowZone ? 25 : 22)); // ~22-25px per char for 44-56px font

  const mode = options?.mode || 'normal';
  const maxTotalLines = options?.maxTotalLines;

  const headlineFontRange =
    mode === 'tight'
      ? (safeZone.width < 260 ? '28-44px' : safeZone.width < 300 ? '44-60px' : '60-76px')
      : (safeZone.width < 260 ? '32-48px' : safeZone.width < 300 ? '52-68px' : '72-84px');

  const bodyFontRange =
    mode === 'tight'
      ? (safeZone.width < 260 ? '22-32px' : safeZone.width < 300 ? '30-42px' : '40-52px')
      : (safeZone.width < 260 ? '24-36px' : safeZone.width < 300 ? '34-46px' : '44-56px');

  console.log('[Gemini Intent] 📏 Zone constraints:', {
    width: safeZone.width,
    isNarrow: isNarrowZone,
    maxCharsHeadline: charLimitHeadline,
    maxCharsBody: charLimitBody
  });

  const prompt = `You are a TEXT FORMATTER for a social media carousel post.

You have been given a SAFE LAYOUT BOX of ${safeZone.width}x${safeZone.height}px.
This box is GUARANTEED to not overlap any images. 

YOUR JOB: Format and break the text into readable lines. DO NOT calculate positions or spacing - we handle that.

TEXT TO ARRANGE:
Headline: "${headline}"
Body: "${body}"

YOUR TASK:
Break the text into lines and decide formatting. Output ONLY content and styling decisions:
- alignItems: Choose horizontal alignment for ALL lines
  * "flex-start" = Left-aligned (BEST for wide boxes > 500px)
  * "center" = Centered (ONLY if text is very short)
  * "flex-end" = Right-aligned
- textLines: Break text into readable lines with formatting

TEXT FORMATTING RULES:
- Headline lines: ${headlineFontRange} font size
- Body lines: ${bodyFontRange} font size
- Bold 2-3 key medical/scientific terms per line for scannability
- Break text into readable lines (don't make lines too long)

CRITICAL WIDTH CONSTRAINTS for this ${safeZone.width}px wide box:
- MAX CHARACTERS PER LINE (Headline 72-84px): ~${charLimitHeadline} chars
- MAX CHARACTERS PER LINE (Body 44-56px): ~${charLimitBody} chars
- If a line exceeds these limits, it will overflow!
- You MUST manually break long text into multiple shorter lines

ALIGNMENT STRATEGY:
- If width > 500px: Use "flex-start" (left-align) for professional look
- If width < 500px: Use "flex-start" (left-align) for narrow column, break into MORE lines
- AVOID "center" unless text is very short

HARD CONSTRAINTS (must obey):
${maxTotalLines ? `- Total number of textLines MUST be <= ${maxTotalLines}` : `- Keep the number of lines as low as possible while staying readable`}
- Each textLine is a SINGLE Fabric.js Textbox object; it MUST NOT wrap internally.
- Therefore: keep each line well under the max characters-per-line limits above.

IMPORTANT: Do NOT specify gap, justifyContent, or Y positions. We calculate spacing dynamically to fit all your lines perfectly in the zone.

Return ONLY this JSON (no markdown, no explanation):
{
  "selectedZone": "${safeZone.id}",
  "alignItems": "flex-start",
  "textLines": [
    {
      "text": "Line of text here",
      "fontSize": 72,
      "styles": [
        { "start": 0, "end": 7, "fontWeight": "bold" }
      ]
    }
  ]
}`;

  console.log('[Gemini Intent] 📤 Sending intent request to Gemini...');
  console.log('[Gemini Intent] 📝 Prompt preview:', prompt.substring(0, 400) + '...');
  if (options?.logFullPrompt || process.env.LOG_GEMINI_PROMPT === 'true') {
    console.log('[Gemini Intent] 🧾 FULL PROMPT START');
    console.log(prompt);
    console.log('[Gemini Intent] 🧾 FULL PROMPT END');
  }

  const maxAttempts = options?.maxAttempts ?? 2;
  const timeoutMs = options?.timeoutMs ?? 12000;

  const withTimeout = async <T,>(p: Promise<T>, label: string): Promise<T> => {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[Gemini Intent] 🔄 Attempt ${attempt}/${maxAttempts}`);

    try {
      const result = await withTimeout(
        model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }],
        }],
        } as any),
        'Gemini generateContent'
      );

      const response = await withTimeout(result.response, 'Gemini response');
      const text = response.text();

      console.log('[Gemini Intent] 📨 Response received');
      console.log('[Gemini Intent] 📄 Raw response (first 500 chars):', text.substring(0, 500));

      // Clean and parse JSON
      let cleaned = text.trim();
      cleaned = cleaned.replace(/^```json\n?/gm, '').replace(/^```\n?/gm, '').replace(/```$/gm, '');

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }

      const intent = JSON.parse(cleaned) as LayoutIntent;

      // Basic validation
      if (!intent.textLines || intent.textLines.length === 0) {
        throw new Error('No text lines in response');
      }

      console.log('[Gemini Intent] ✅ Intent parsed successfully');
      console.log('[Gemini Intent] 📊 Layout strategy:');
      console.log(`[Gemini Intent]   Zone: ${intent.selectedZone}`);
      console.log(`[Gemini Intent]   Alignment: ${intent.alignItems} (horizontal), ${intent.justifyContent} (vertical)`);
      console.log(`[Gemini Intent]   Gap: ${intent.gap}px`);
      console.log(`[Gemini Intent]   Lines: ${intent.textLines.length}`);

      intent.textLines.forEach((line, idx) => {
        console.log(`[Gemini Intent]     Line ${idx + 1}: "${line.text.substring(0, 40)}" (${line.fontSize}px)`);
      });

      return intent;

    } catch (error) {
      console.error(`[Gemini Intent] ❌ Attempt ${attempt} failed:`, error);

      if (attempt >= maxAttempts) {
        throw new Error(`Failed to generate layout intent after ${maxAttempts} attempts`);
      }

      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
  }

  throw new Error('Failed to generate layout intent');
}

