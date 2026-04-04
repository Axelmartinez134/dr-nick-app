import 'server-only';

function s(v: any): string {
  return typeof v === 'string' ? String(v).trim() : '';
}

export function decodeHtmlEntities(input: string): string {
  const raw = String(input || '');
  if (!raw) return '';
  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (m, num) => {
      const code = Number.parseInt(String(num), 10);
      if (!Number.isFinite(code)) return m;
      try {
        return String.fromCodePoint(code);
      } catch {
        return m;
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (m, hex) => {
      const code = Number.parseInt(String(hex), 16);
      if (!Number.isFinite(code)) return m;
      try {
        return String.fromCodePoint(code);
      } catch {
        return m;
      }
    });
}

export function cleanYoutubeTranscriptText(input: string): string {
  let text = decodeHtmlEntities(input);
  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/\s*>>\s*/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export function extractYoutubeTranscriptFromApify(raw: any): {
  transcript: string | null;
  captionsSource: any;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  description: string;
} {
  const captionsSource = raw?.captions ?? null;
  let transcriptRaw: string | null = null;

  if (Array.isArray(captionsSource)) {
    const strings = captionsSource
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (typeof entry?.text === 'string') return String(entry.text);
        return '';
      })
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    transcriptRaw = strings.length ? strings.join(' ') : null;
  } else if (typeof captionsSource === 'string') {
    transcriptRaw = String(captionsSource || '').trim() || null;
  }

  const transcript = transcriptRaw ? cleanYoutubeTranscriptText(transcriptRaw) : null;

  return {
    transcript,
    captionsSource,
    title: s(raw?.title),
    channelName: s(raw?.channelName),
    thumbnailUrl: s(raw?.thumbnailUrl),
    description: s(raw?.description),
  };
}
