import 'server-only';

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE ||
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export function requireServiceClient() {
  const svc = serviceClient();
  if (!svc) throw new Error('Server missing Supabase service role env');
  return svc;
}

export function requireOpenAiKey(): string {
  const k = String(process.env.OPENAI_API_KEY || '').trim();
  if (!k) throw new Error('Server missing OPENAI_API_KEY');
  return k;
}

export async function downloadMp4FromUrl(downloadedVideoUrl: string): Promise<Buffer> {
  const url = String(downloadedVideoUrl || '').trim();
  if (!url) throw new Error('downloadedVideoUrl is required');
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`Failed to download reel video (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('Downloaded video was empty');
  return buf;
}

export async function uploadMp4ToReelsBucket(args: { svc: any; path: string; buf: Buffer }) {
  const path = String(args.path || '').trim().replace(/^\/+/, '');
  if (!path) throw new Error('path is required');
  const { error } = await args.svc.storage.from('reels').upload(path, args.buf, {
    upsert: true,
    contentType: 'video/mp4',
  });
  if (error) throw new Error(error.message);
  return { bucket: 'reels' as const, path };
}

export async function whisperTranscribeMp4Bytes(args: { apiKey: string; mp4Bytes: Uint8Array; filename: string }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  try {
    const form = new FormData();
    // Node 20 provides File.
    const f = new File([args.mp4Bytes], args.filename, { type: 'video/mp4' });
    form.append('file', f);
    form.append('model', 'whisper-1');
    form.append('response_format', 'json');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${args.apiKey}` },
      body: form,
      signal: controller.signal,
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = String(j?.error?.message || j?.error || `Whisper failed (${res.status})`);
      throw new Error(msg);
    }
    const text = typeof j?.text === 'string' ? j.text : '';
    return { text };
  } finally {
    clearTimeout(timeout);
  }
}

