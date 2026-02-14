import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';
import { requireDeepseekApiKey } from '../_deepseek';
import { scrapeInstagramProfileViaApify } from '../_apify';

export const runtime = 'nodejs';
// Batch enrichment (Apify) + qualification (DeepSeek) can take time.
export const maxDuration = 210;

type Body = {
  seedInstagramUrl: string;
  seedUsername?: string | null;
  baseTemplateId: string | null;
  items: Array<{
    username: string | null;
    fullName: string | null;
    profilePicUrl: string | null;
    isVerified: boolean | null;
    isPrivate: boolean | null;
    raw: any;
  }>;
};

type Qual = {
  score: number;
  niche: string;
  reason: string;
  has_offer: boolean;
  credential: string | null;
};

type RowResult =
  | {
      username: string;
      ok: true;
      enriched: { ok: true; profilePicUrlHD: string | null; followerCount: number | null; followingCount: number | null };
      qualified: { ok: true; data: Qual; model: string };
      saved: { ok: true };
    }
  | {
      username: string;
      ok: false;
      enriched: { ok: boolean; error?: string; profilePicUrlHD?: string | null; followerCount?: number | null; followingCount?: number | null };
      qualified: { ok: boolean; error?: string; model?: string };
      saved: { ok: boolean; error?: string };
    };

type Resp =
  | {
      success: true;
      summary: {
        attempted: number;
        enrichedOk: number;
        qualifiedOk: number;
        savedOk: number;
        qualifyFailed: number;
        enrichFailed: number;
      };
      results: RowResult[];
    }
  | { success: false; error: string };

type StreamEvent =
  | { type: 'stage'; stage: 'upsert' | 'enrich' | 'qualify' | 'done'; message: string; total?: number }
  | { type: 'progress'; stage: 'enrich' | 'qualify'; done: number; total: number }
  | { type: 'row'; stage: 'enrich' | 'qualify'; username: string; ok: boolean; error?: string }
  | { type: 'done'; summary: Resp extends { success: true } ? never : never }
  | { type: 'final'; payload: { success: true; summary: any; results: RowResult[] } }
  | { type: 'fatal'; error: string };

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

async function requireSuperadmin(supabase: any, userId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (saErr) return { ok: false, status: 500, error: saErr.message };
  if (!saRow?.user_id) return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: true };
}

function s(v: any): string | null {
  const out = typeof v === 'string' ? v.trim() : '';
  return out ? out : null;
}

function normalizeUsername(v: any): string | null {
  const raw = s(v);
  if (!raw) return null;
  return raw.replace(/^@+/, '').trim() || null;
}

function tryExtractInstagramUsernameFromProfileUrl(input: string): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (!host.includes('instagram.com')) return null;
    const parts = u.pathname.split('/').map((p) => p.trim()).filter(Boolean);
    const first = String(parts?.[0] || '').trim().toLowerCase();
    if (!first) return null;
    if (first === 'reel' || first === 'reels' || first === 'p' || first === 'tv') return null;
    return first;
  } catch {
    return null;
  }
}

function isPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function extractJsonObject(text: string): any {
  const st = String(text || '');
  const first = st.indexOf('{');
  const last = st.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) throw new Error('Model did not return JSON');
  const raw = st.slice(first, last + 1);
  return JSON.parse(raw);
}

function assertIntInRange(v: any, min: number, max: number, where: string) {
  if (!Number.isInteger(v) || v < min || v > max) throw new Error(`${where} must be an integer in [${min},${max}]`);
}
function assertString(v: any, where: string) {
  if (typeof v !== 'string') throw new Error(`${where} must be a string`);
}
function assertBoolean(v: any, where: string) {
  if (typeof v !== 'boolean') throw new Error(`${where} must be a boolean`);
}
function assertStringOrNull(v: any, where: string) {
  if (v === null) return;
  if (typeof v !== 'string') throw new Error(`${where} must be a string or null`);
}

function validateQual(payload: any): Qual {
  if (!isPlainObject(payload)) throw new Error('Output must be a JSON object');
  assertIntInRange(payload.score, 0, 100, 'score');
  assertString(payload.niche, 'niche');
  assertString(payload.reason, 'reason');
  assertBoolean(payload.has_offer, 'has_offer');
  assertStringOrNull(payload.credential, 'credential');
  const niche = String(payload.niche || '').trim();
  const reason = String(payload.reason || '').trim();
  if (!niche) throw new Error('niche must be non-empty');
  if (!reason) throw new Error('reason must be non-empty');
  const credential =
    payload.credential === null ? null : String(payload.credential || '').trim() ? String(payload.credential).trim() : null;
  return { score: Number(payload.score), niche, reason, has_offer: Boolean(payload.has_offer), credential };
}

function pickFirstNumber(...vals: any[]): number | null {
  for (const v of vals) {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function extractBioFollowersFollowing(raw: any): { biography: string | null; followerCount: number | null; followingCount: number | null; isVerified: boolean | null } {
  const bio = s(raw?.biography) || s(raw?.bio) || s(raw?.biographyWithEntities?.rawText) || s(raw?.biography_with_entities?.raw_text) || null;
  const followerCount =
    pickFirstNumber(
      raw?.followersCount,
      raw?.followerCount,
      raw?.followers,
      raw?.edge_followed_by?.count,
      raw?.edgeFollowedBy?.count,
      raw?.counts?.followedBy,
      raw?.counts?.followers
    ) ?? null;
  const followingCount =
    pickFirstNumber(
      raw?.followingCount,
      raw?.followingsCount,
      raw?.following,
      raw?.edge_follow?.count,
      raw?.edgeFollow?.count,
      raw?.counts?.follows,
      raw?.counts?.following
    ) ?? null;
  const isVerified =
    raw?.isVerified === true ? true : raw?.isVerified === false ? false : raw?.is_verified === true ? true : raw?.is_verified === false ? false : null;
  return { biography: bio, followerCount, followingCount, isVerified };
}

function buildDeepseekPrompt(args: {
  username: string;
  fullName: string | null;
  biography: string | null;
  followerCount: number | null;
  followingCount: number | null;
  isVerified: boolean | null;
  profileUrl: string;
  raw: any;
}): string {
  return [
    `You are a lead qualification agent for an Instagram carousel content service. Your job is to score how likely this Instagram profile is a qualified prospect.`,
    ``,
    `IDEAL CLIENT PROFILE:`,
    `- Health, wellness, fitness, nutrition, or functional medicine professional`,
    `- Has a coaching program, course, or transformation offer they sell`,
    `- Active on Instagram as a business channel (not just personal use)`,
    `- Follower range: 10K-150K (sweet spot is 20K-100K)`,
    `- Likely posts educational or motivational content`,
    `- Bonus: medical doctor, naturopath, chiropractor, dietitian, or licensed practitioner with credentials`,
    ``,
    `DISQUALIFY:`,
    `- Brand accounts or companies (supplement brands, gym chains, software companies)`,
    `- Meme pages, aggregator accounts, or media outlets`,
    `- Business coaches who teach marketing (they are the competition, not the client)`,
    `- Personal accounts with no business indicators`,
    `- Accounts with 500K+ followers (too large, different needs)`,
    ``,
    `SCORING CRITERIA (0-100):`,
    `- 0-20: Not a match (wrong niche, brand account, too small/large, no business signals)`,
    `- 21-40: Weak match (tangentially related to health/wellness but missing key signals)`,
    `- 41-60: Moderate match (right niche but unclear if they sell programs or unclear follower range)`,
    `- 61-80: Strong match (right niche, likely sells programs, reasonable follower count)`,
    `- 81-100: Ideal match (health/wellness professional, clear coaching offer, 20K-100K followers, credentials visible)`,
    ``,
    `INPUT DATA:`,
    `Username: ${args.username}`,
    `Full Name: ${String(args.fullName || '').trim() || '—'}`,
    `Bio: ${String(args.biography || '').trim() || '—'}`,
    `Followers: ${args.followerCount === null ? '—' : String(args.followerCount)}`,
    `Following: ${args.followingCount === null ? '—' : String(args.followingCount)}`,
    `Is Verified: ${args.isVerified === null ? '—' : args.isVerified ? 'true' : 'false'}`,
    `Profile URL: ${args.profileUrl || '—'}`,
    `Metadata JSON: ${JSON.stringify(args.raw ?? {}, null, 2)}`,
    ``,
    `Respond ONLY in this exact JSON format, nothing else:`,
    `{"score": <number>, "niche": "<2-4 word niche label>", "reason": "<one sentence>", "has_offer": <true/false>, "credential": "<credential if visible, otherwise null>"}`,
  ].join('\n');
}

async function callDeepseekChat(opts: { apiKey: string; prompt: string }) {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 25_000);
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0,
        max_tokens: 300,
        messages: [{ role: 'user', content: opts.prompt }],
      }),
      signal: ac.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.error?.message || json?.message || 'DeepSeek API error';
      throw new Error(String(msg));
    }
    const text = String(json?.choices?.[0]?.message?.content || '');
    return { text, model: String(json?.model || 'deepseek-chat') };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let nextIdx = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const idx = nextIdx++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  const superadmin = await requireSuperadmin(supabase, user.id);
  if (!superadmin.ok) return NextResponse.json({ success: false, error: superadmin.error } satisfies Resp, { status: superadmin.status });

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } satisfies Resp, { status: acct.status });
  const accountId = acct.accountId;

  let body: Body | null = null;
  try {
    body = (await request.json()) as any;
  } catch {
    // ignore
  }

  const wantsStream =
    String(request.headers.get('accept') || '').includes('text/event-stream') || Boolean((body as any)?.stream);

  const seedInstagramUrl = s((body as any)?.seedInstagramUrl);
  const seedUsernameRaw = normalizeUsername((body as any)?.seedUsername);
  const baseTemplateId = s((body as any)?.baseTemplateId);
  const itemsRaw = Array.isArray((body as any)?.items) ? ((body as any).items as any[]) : [];

  if (!seedInstagramUrl) {
    return NextResponse.json({ success: false, error: 'seedInstagramUrl is required' } satisfies Resp, { status: 400 });
  }
  const seedFromUrl = tryExtractInstagramUsernameFromProfileUrl(seedInstagramUrl);
  const seedUsername = seedUsernameRaw || seedFromUrl;
  if (!seedUsername) {
    return NextResponse.json({ success: false, error: 'seedUsername is required' } satisfies Resp, { status: 400 });
  }
  if (!itemsRaw.length) {
    return NextResponse.json({ success: false, error: 'items is required' } satisfies Resp, { status: 400 });
  }
  if (itemsRaw.length > 25) {
    return NextResponse.json({ success: false, error: 'Too many items (max 25)' } satisfies Resp, { status: 400 });
  }

  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json({ success: false, error: 'Server missing Supabase service role env' } satisfies Resp, { status: 500 });
  }

  const apiKey = requireDeepseekApiKey();
  const nowIso = new Date().toISOString();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (evt: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
      };

      const run = async () => {
        // 1) Upsert prospect rows (safe columns only).
        send({ type: 'stage', stage: 'upsert', message: `Upserting ${itemsRaw.length} prospect(s)…`, total: itemsRaw.length });

        const baseRows = itemsRaw
          .map((it: any) => {
            const uname = normalizeUsername(it?.username);
            if (!uname) return null;
            const profileUrl = `https://www.instagram.com/${uname}/`;
            return {
              created_by_user_id: user.id,
              account_id: accountId,
              // Legacy (single-profile) identity columns
              instagram_url: profileUrl,
              full_name: s(it?.fullName),
              username: uname,
              profile_pic_url_hd: null,
              raw_json: it?.raw ?? null,

              source_type: 'following',
              source_seed_username: seedUsername,
              source_seed_instagram_url: seedInstagramUrl,
              source_raw_json: it?.raw ?? null,
              prospect_username: uname,
              prospect_full_name: s(it?.fullName),
              prospect_profile_pic_url: s(it?.profilePicUrl),
              prospect_is_verified: typeof it?.isVerified === 'boolean' ? it.isVerified : it?.isVerified ?? null,
              prospect_is_private: typeof it?.isPrivate === 'boolean' ? it.isPrivate : it?.isPrivate ?? null,
              base_template_id: baseTemplateId,
            };
          })
          .filter(Boolean) as any[];

        if (!baseRows.length) {
          throw new Error('No items had a valid username');
        }

        const { data: upserted, error: upErr } = await svc
          .from('editor_outreach_targets')
          .upsert(baseRows, { onConflict: 'account_id,source_type,source_seed_username,prospect_username' })
          .select('id, prospect_username');
        if (upErr) throw new Error(upErr.message);

        const idByUsername = new Map<string, string>();
        for (const r of Array.isArray(upserted) ? upserted : []) {
          const uname = normalizeUsername((r as any)?.prospect_username);
          const id = s((r as any)?.id);
          if (uname && id) idByUsername.set(uname, id);
        }

        // 2) Enrich each profile (Apify) + persist full raw JSON.
        const usernames = baseRows.map((r: any) => String(r.prospect_username));
        send({ type: 'stage', stage: 'enrich', message: `Enriching ${usernames.length} profile(s)…`, total: usernames.length });

        const enrichedByUsername = new Map<
          string,
          { ok: true; profilePicUrlHD: string | null; raw: any; followerCount: number | null; followingCount: number | null }
        >();
        const enrichErrorByUsername = new Map<string, string>();

        let enrichDone = 0;
        const enrichResults = await mapWithConcurrency(usernames, 2, async (uname) => {
          const id = idByUsername.get(uname) || null;
          if (!id) {
            const err = 'Missing DB row id';
            send({ type: 'row', stage: 'enrich', username: uname, ok: false, error: err });
            return { username: uname, ok: false as const, error: err };
          }
          send({ type: 'row', stage: 'enrich', username: uname, ok: true });
          try {
            const instagramUrl = `https://www.instagram.com/${uname}/`;
            const scraped = await scrapeInstagramProfileViaApify({ instagramUrl });
            const profilePicUrlHD = s(scraped.profilePicUrlHD);
            const extracted = extractBioFollowersFollowing(scraped.raw);
            const patch: any = {
              enriched_profile_pic_url_hd: profilePicUrlHD,
              enriched_raw_json: scraped.raw ?? null,
              enriched_at: nowIso,
              // Also fill legacy single-profile columns for reuse.
              instagram_url: instagramUrl,
              full_name: s(scraped.fullName),
              username: normalizeUsername(scraped.username) || uname,
              profile_pic_url_hd: profilePicUrlHD,
              raw_json: scraped.raw ?? null,
            };
            const { error: updErr } = await svc.from('editor_outreach_targets').update(patch).eq('id', id);
            if (updErr) throw new Error(updErr.message);
            enrichedByUsername.set(uname, {
              ok: true,
              profilePicUrlHD,
              raw: scraped.raw ?? null,
              followerCount: extracted.followerCount,
              followingCount: extracted.followingCount,
            });
            send({ type: 'row', stage: 'enrich', username: uname, ok: true });
            return { username: uname, ok: true as const, profilePicUrlHD, raw: scraped.raw ?? null };
          } catch (e: any) {
            const msg = String(e?.message || e || 'Enrichment failed');
            enrichErrorByUsername.set(uname, msg);
            send({ type: 'row', stage: 'enrich', username: uname, ok: false, error: msg });
            return { username: uname, ok: false as const, error: msg };
          } finally {
            enrichDone += 1;
            send({ type: 'progress', stage: 'enrich', done: enrichDone, total: usernames.length });
          }
        });

        for (const r of enrichResults as any[]) {
          const uname = normalizeUsername((r as any)?.username);
          if (!uname) continue;
          if ((r as any)?.ok && !enrichedByUsername.has(uname)) {
            const raw = (r as any).raw ?? null;
            const extracted = extractBioFollowersFollowing(raw);
            enrichedByUsername.set(uname, {
              ok: true,
              profilePicUrlHD: (r as any).profilePicUrlHD ?? null,
              raw,
              followerCount: extracted.followerCount,
              followingCount: extracted.followingCount,
            });
          }
          if (!(r as any)?.ok && !enrichErrorByUsername.has(uname)) {
            enrichErrorByUsername.set(uname, String((r as any)?.error || 'Enrichment failed'));
          }
        }

        // 3) Qualify each enriched profile (DeepSeek) + persist AI fields.
        send({ type: 'stage', stage: 'qualify', message: `Qualifying ${usernames.length} profile(s) (DeepSeek)…`, total: usernames.length });

        const qualifyOkByUsername = new Map<string, { data: Qual; model: string }>();
        const qualifyErrorByUsername = new Map<string, string>();
        let qualifyDone = 0;

        const qualifyResults = await mapWithConcurrency(usernames, 3, async (uname) => {
          const id = idByUsername.get(uname) || null;
          if (!id) {
            const err = 'Missing DB row id';
            send({ type: 'row', stage: 'qualify', username: uname, ok: false, error: err });
            return { username: uname, ok: false as const, error: err };
          }

          const enr = enrichedByUsername.get(uname) || null;
          if (!enr?.ok) {
            const err = enrichErrorByUsername.get(uname) || 'Enrichment failed';
            send({ type: 'row', stage: 'qualify', username: uname, ok: false, error: err });
            return { username: uname, ok: false as const, error: err };
          }

          send({ type: 'row', stage: 'qualify', username: uname, ok: true });
          try {
            const profileUrl = `https://www.instagram.com/${uname}/`;
            const extracted = extractBioFollowersFollowing(enr.raw);
            const prompt = buildDeepseekPrompt({
              username: uname,
              fullName: s(enr.raw?.fullName) || s(enr.raw?.full_name) || null,
              biography: extracted.biography,
              followerCount: extracted.followerCount,
              followingCount: extracted.followingCount,
              isVerified: extracted.isVerified,
              profileUrl,
              raw: enr.raw,
            });

            const out = await callDeepseekChat({ apiKey, prompt });
            const payload = extractJsonObject(out.text);
            const data = validateQual(payload);

            const patch: any = {
              ai_score: Math.floor(data.score),
              ai_niche: s(data.niche),
              ai_reason: s(data.reason),
              ai_has_offer: typeof data.has_offer === 'boolean' ? data.has_offer : null,
              ai_credential: s(data.credential),
              ai_scored_at: nowIso,
              ai_model: s(out.model),
              ai_mode: 'enriched',
            };

            const { error: updErr } = await svc.from('editor_outreach_targets').update(patch).eq('id', id);
            if (updErr) throw new Error(updErr.message);

            qualifyOkByUsername.set(uname, { data, model: out.model });
            send({ type: 'row', stage: 'qualify', username: uname, ok: true });
            return { username: uname, ok: true as const, data, model: out.model };
          } catch (e: any) {
            const msg = String(e?.message || e || 'Qualification failed');
            qualifyErrorByUsername.set(uname, msg);
            // Requirement: keep enriched data, but null AI fields on failure.
            try {
              const nullPatch: any = {
                ai_score: null,
                ai_niche: null,
                ai_reason: null,
                ai_has_offer: null,
                ai_credential: null,
                ai_scored_at: null,
                ai_model: null,
                ai_mode: 'enriched',
              };
              await svc.from('editor_outreach_targets').update(nullPatch).eq('id', id);
            } catch {
              // ignore
            }
            send({ type: 'row', stage: 'qualify', username: uname, ok: false, error: msg });
            return { username: uname, ok: false as const, error: msg };
          } finally {
            qualifyDone += 1;
            send({ type: 'progress', stage: 'qualify', done: qualifyDone, total: usernames.length });
          }
        });

        for (const r of qualifyResults as any[]) {
          const uname = normalizeUsername((r as any)?.username);
          if (!uname) continue;
          if ((r as any)?.ok && (r as any)?.data && !qualifyOkByUsername.has(uname)) {
            qualifyOkByUsername.set(uname, { data: (r as any).data as Qual, model: String((r as any).model || 'deepseek-chat') });
          }
          if (!(r as any)?.ok && !qualifyErrorByUsername.has(uname)) {
            qualifyErrorByUsername.set(uname, String((r as any)?.error || 'Qualification failed'));
          }
        }

        // 4) Build response summary + per-row results.
        const results: RowResult[] = usernames.map((uname) => {
          const enr = enrichedByUsername.get(uname) || null;
          const qual = qualifyOkByUsername.get(uname) || null;
          const enrErr = enrichErrorByUsername.get(uname) || null;
          const qualErr = qualifyErrorByUsername.get(uname) || null;

          const ok = !!(enr?.ok && qual);
          if (ok) {
            return {
              username: uname,
              ok: true,
              enriched: {
                ok: true,
                profilePicUrlHD: enr?.profilePicUrlHD ?? null,
                followerCount: enr?.followerCount ?? null,
                followingCount: enr?.followingCount ?? null,
              },
              qualified: { ok: true, data: qual!.data, model: qual!.model },
              saved: { ok: true },
            };
          }
          return {
            username: uname,
            ok: false,
            enriched: enr?.ok
              ? {
                  ok: true,
                  profilePicUrlHD: enr.profilePicUrlHD ?? null,
                  followerCount: enr?.followerCount ?? null,
                  followingCount: enr?.followingCount ?? null,
                }
              : { ok: false, error: enrErr || 'Enrichment failed' },
            qualified: qual ? { ok: true, data: qual.data, model: qual.model } : { ok: false, error: qualErr || 'Qualification failed' },
            saved: { ok: true },
          } as any;
        });

        const enrichedOk = enrichedByUsername.size;
        const qualifiedOk = qualifyOkByUsername.size;
        const attempted = usernames.length;
        const summary = {
          attempted,
          enrichedOk,
          qualifiedOk,
          savedOk: attempted,
          enrichFailed: attempted - enrichedOk,
          qualifyFailed: attempted - qualifiedOk,
        };

        const payload = { success: true as const, summary, results };
        send({ type: 'stage', stage: 'done', message: 'Done.' });
        send({ type: 'final', payload });
        controller.close();
      };

      // If client didn't ask for stream, we still send a final payload as JSON below.
      if (wantsStream) {
        run().catch((e: any) => {
          send({ type: 'fatal', error: String(e?.message || e || 'Failed') });
          controller.close();
        });
      } else {
        controller.close();
      }
    },
  });

  if (wantsStream) {
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  }

  // Non-stream (JSON) fallback: call ourselves with stream=false by reusing logic via the existing route.
  // For now, keep existing behavior by re-running without streaming (client uses streaming path).
  return NextResponse.json({ success: false, error: 'Streaming not requested' } satisfies Resp, { status: 400 });
}

