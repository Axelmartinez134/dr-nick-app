import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export type EmphasisLineStyles = Array<{ start: number; end: number; fontWeight?: string; fontStyle?: string }>;

export async function getEmphasisStylesForLinesClaude(
  lines: Array<{ text: string }>,
  options?: {
    timeoutMs?: number;
    maxAttempts?: number;
  }
): Promise<EmphasisLineStyles[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key is not configured');
  }

  const timeoutMs = options?.timeoutMs ?? 20_000;
  const maxAttempts = options?.maxAttempts ?? 1;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const numberedLines = lines.map((l, i) => `${i}: ${l.text}`).join('\n');
  const prompt = `You are a typography assistant.

TASK: Add emphasis (bold/italic) to existing text lines for a social media carousel.

RULES:
- DO NOT change any characters in the text.
- DO NOT add or remove lines.
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

  console.log('[Claude Styles] ✨ Requesting emphasis styles...');
  console.log('[Claude Styles] 📄 Lines:', lines.length);

  const withTimeout = async <T,>(p: Promise<T>, label: string): Promise<T> => {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await withTimeout(
        client.messages.create({
          model: 'claude-3-7-sonnet-20250219',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
        'Claude messages.create'
      );

      const content = response.content?.[0];
      if (!content || content.type !== 'text') {
        throw new Error('Unexpected Claude response type');
      }

      let cleaned = content.text.trim();
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

      console.log('[Claude Styles] ✅ Styles parsed');
      return out;
    } catch (e) {
      console.warn(`[Claude Styles] ❌ Attempt ${attempt} failed:`, e);
      if (attempt >= maxAttempts) throw e;
    }
  }

  return Array.from({ length: lines.length }, () => []);
}


