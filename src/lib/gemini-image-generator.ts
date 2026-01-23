import 'server-only';

type GeminiImageConfig = {
  aspectRatio?: string; // e.g. "3:4"
  imageSize?: string; // e.g. "1K" | "2K" | "4K"
};

export async function generateGeminiImagePng(opts: {
  prompt: string;
  model: 'gemini-3-pro-image-preview';
  apiKey: string;
  imageConfig?: GeminiImageConfig;
}): Promise<{ bytes: Buffer; mimeType: 'image/png' | 'image/jpeg' | string; model: string }> {
  const apiKey = String(opts.apiKey || '').trim();
  if (!apiKey) throw new Error('Missing env var: GOOGLE_AI_API_KEY');
  const prompt = String(opts.prompt || '').trim();
  if (!prompt) throw new Error('Prompt is required');

  // Gemini API image generation (REST)
  // Docs: https://ai.google.dev/gemini-api/docs/image-generation
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    opts.model
  )}:generateContent`;

  const aspectRatio = String(opts.imageConfig?.aspectRatio || '3:4').trim();
  const imageSize = String(opts.imageConfig?.imageSize || '1K').trim();

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 60_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          // Request both TEXT + IMAGE so we can reliably receive inline image bytes.
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        },
      }),
      signal: ac.signal,
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json ? JSON.stringify(json).slice(0, 800) : '';
      throw new Error(`Gemini image error (${res.status}): ${msg || 'Unknown error'}`);
    }

    const candidates = Array.isArray((json as any)?.candidates) ? (json as any).candidates : [];
    const parts = candidates?.[0]?.content?.parts;
    const arr = Array.isArray(parts) ? parts : [];

    // Prefer inline image data.
    for (const p of arr) {
      const inline = (p as any)?.inlineData || (p as any)?.inline_data || null;
      const mime = String(inline?.mimeType || inline?.mime_type || '').trim();
      const dataB64 = String(inline?.data || '').trim();
      if (!dataB64) continue;
      // Gemini may return JPEG; we handle conversion to PNG at the pipeline level (RemoveBG can output PNG).
      return {
        bytes: Buffer.from(dataB64, 'base64'),
        mimeType: (mime as any) || 'image/png',
        model: opts.model,
      };
    }

    throw new Error('Gemini returned no inline image data');
  } finally {
    clearTimeout(t);
  }
}

