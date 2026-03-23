import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSwipeSuperadminContext } from '../../../../_utils';
import {
  buildSwipeTopicsContextText,
  buildSwipeTopicsSystemText,
  isUuid,
  loadSwipeIdeasContextOrThrow,
  sanitizePrompt,
} from '../_shared';

export const runtime = 'nodejs';
export const maxDuration = 120;

type Resp = { success: true; bullets: string[] } | { success: false; error: string };

function extractJsonObject(text: string): any {
  const raw = String(text || '');
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) throw new Error('Model did not return JSON');
  return JSON.parse(raw.slice(first, last + 1));
}

function assertTopics(payload: any): { bullets: string[] } {
  const bulletsIn = payload?.bullets;
  if (!Array.isArray(bulletsIn) || bulletsIn.length < 1) {
    throw new Error('Invalid output: bullets must be a non-empty array');
  }
  const bullets = bulletsIn
    .map((item: any) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 12);
  if (bullets.length < 1) throw new Error('Invalid output: bullets must be a non-empty array');
  return { bullets };
}

async function callAnthropicJson(args: { system: string; temperature?: number; max_tokens?: number }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
  if (!apiKey) throw new Error('Missing env var: ANTHROPIC_API_KEY');

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 90_000);
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
        max_tokens: typeof args.max_tokens === 'number' ? args.max_tokens : 1400,
        temperature: typeof args.temperature === 'number' ? args.temperature : 0.1,
        system: args.system,
        messages: [{ role: 'user', content: 'Analyze the source material and return the topics JSON now.' }],
      }),
      signal: ac.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.error?.message || JSON.stringify(json)?.slice(0, 500) || 'Unknown Anthropic error';
      throw new Error(`Anthropic error (${res.status}): ${msg}`);
    }
    const content0 = json?.content?.[0];
    return String(content0?.text || '');
  } finally {
    clearTimeout(t);
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthedSwipeSuperadminContext(request);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
    const { supabase, accountId } = auth;

    const { id } = await ctx.params;
    const swipeItemId = String(id || '').trim();
    if (!swipeItemId || !isUuid(swipeItemId)) {
      return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });
    }

    const swipeContext = await loadSwipeIdeasContextOrThrow({ supabase, accountId, swipeItemId });
    const system = sanitizePrompt([buildSwipeTopicsSystemText(), buildSwipeTopicsContextText({ context: swipeContext })].join('\n\n'));

    const parsed = await (async () => {
      try {
        const rawText = await callAnthropicJson({ system, temperature: 0.1, max_tokens: 1400 });
        return assertTopics(extractJsonObject(rawText));
      } catch {
        const retrySystem =
          system +
          '\n\n' +
          sanitizePrompt(
            [
              'FORMAT_ERROR: Your previous response was invalid.',
              'Return ONLY the JSON object in the required shape. No markdown. No explanation.',
            ].join('\n')
          );
        const retryText = await callAnthropicJson({ system: retrySystem, temperature: 0, max_tokens: 1200 });
        return assertTopics(extractJsonObject(retryText));
      }
    })();

    return NextResponse.json({ success: true, bullets: parsed.bullets } satisfies Resp);
  } catch (e: any) {
    const msg = String(e?.message || 'Failed');
    const lower = msg.toLowerCase();
    const status =
      msg === 'Not found'
        ? 404
        : lower.includes('transcript missing') || lower.includes('transcript too long')
          ? 400
          : 500;
    return NextResponse.json({ success: false, error: msg } satisfies Resp, { status });
  }
}
