export type ScrapeFollowingItem = {
  seedUsername: string;
  username: string | null;
  fullName: string | null;
  profilePicUrl: string | null;
  isVerified: boolean | null;
  isPrivate: boolean | null;
  raw: any;
};

export type LiteQualification = {
  score: number;
  niche: string;
  reason: string;
  has_offer: boolean;
  credential: string | null;
};

export type EnrichQualifySaveSummary = {
  attempted: number;
  enrichedOk: number;
  qualifiedOk: number;
  savedOk: number;
  qualifyFailed: number;
  enrichFailed: number;
};

export type EnrichQualifySaveRow =
  | {
      username: string;
      ok: true;
      enriched: { ok: true; profilePicUrlHD: string | null; followerCount: number | null; followingCount: number | null };
      qualified: { ok: true; data: LiteQualification; model: string };
      saved: { ok: true };
    }
  | {
      username: string;
      ok: false;
      enriched: { ok: boolean; error?: string; profilePicUrlHD?: string | null; followerCount?: number | null; followingCount?: number | null };
      qualified: { ok: boolean; error?: string; model?: string; data?: LiteQualification };
      saved: { ok: boolean; error?: string };
    };

export type EnrichQualifySaveStreamEvent =
  | { type: 'stage'; stage: 'upsert' | 'enrich' | 'qualify' | 'done'; message: string; total?: number }
  | { type: 'progress'; stage: 'enrich' | 'qualify'; done: number; total: number }
  | { type: 'row'; stage: 'enrich' | 'qualify'; username: string; ok: boolean; error?: string }
  | { type: 'final'; payload: { success: true; summary: EnrichQualifySaveSummary; results: EnrichQualifySaveRow[] } }
  | { type: 'fatal'; error: string };

export type ReelScrape = {
  reelUrl: string;
  shortcode: string | null;
  ownerUsername: string | null;
  ownerFullName: string | null;
  caption: string | null;
  transcript: string | null;
  downloadedVideoUrl?: string | null;
  raw: any;
};

export async function scrapeReel(args: {
  token: string;
  reelUrl: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<ReelScrape> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');
  const reelUrl = String(args.reelUrl || '').trim();
  if (!reelUrl) throw new Error('reelUrl is required');

  const res = await fetch('/api/editor/outreach/scrape-reel', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({ reelUrl }),
    signal: args.signal,
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Scrape failed (${res.status})`));
  const d = j?.data ?? null;
  return {
    reelUrl: String(d?.reelUrl || reelUrl).trim(),
    shortcode: typeof d?.shortcode === 'string' ? d.shortcode : d?.shortcode ?? null,
    ownerUsername: typeof d?.ownerUsername === 'string' ? d.ownerUsername : d?.ownerUsername ?? null,
    ownerFullName: typeof d?.ownerFullName === 'string' ? d.ownerFullName : d?.ownerFullName ?? null,
    caption: typeof d?.caption === 'string' ? d.caption : d?.caption ?? null,
    transcript: typeof d?.transcript === 'string' ? d.transcript : d?.transcript ?? null,
    downloadedVideoUrl: typeof d?.downloadedVideoUrl === 'string' ? d.downloadedVideoUrl : d?.downloadedVideoUrl ?? null,
    raw: d?.raw ?? null,
  };
}

export async function downloadReelVideo(args: {
  token: string;
  reelUrl: string;
  shortcode?: string | null;
  projectId: string;
  headers?: Record<string, string>;
}): Promise<{ bucket: 'reels'; path: string }> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');
  const reelUrl = String(args.reelUrl || '').trim();
  const projectId = String(args.projectId || '').trim();
  if (!reelUrl) throw new Error('reelUrl is required');
  if (!projectId) throw new Error('projectId is required');

  const res = await fetch('/api/editor/outreach/reel-video', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({ reelUrl, shortcode: args.shortcode ?? null, projectId }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Video download failed (${res.status})`));
  return { bucket: 'reels', path: String(j?.path || '').trim() };
}

export async function transcribeStoredReelVideo(args: {
  token: string;
  bucket: 'reels';
  path: string;
  headers?: Record<string, string>;
}): Promise<{ transcript: string }> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');
  const bucket = String(args.bucket || '').trim();
  const path = String(args.path || '').trim();
  if (bucket !== 'reels') throw new Error('bucket must be "reels"');
  if (!path) throw new Error('path is required');

  const res = await fetch('/api/editor/outreach/transcribe', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({ bucket: 'reels', path }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Transcribe failed (${res.status})`));
  const transcript = String(j?.transcript || '').trim();
  if (!transcript) throw new Error('Transcribe returned empty transcript');
  return { transcript };
}

export async function generateTopicLine(args: {
  token: string;
  caption?: string | null;
  transcript?: string | null;
  headers?: Record<string, string>;
}): Promise<{ topicLine: string; model: string }> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');
  const caption = typeof args.caption === 'string' ? args.caption : args.caption ?? null;
  const transcript = typeof args.transcript === 'string' ? args.transcript : args.transcript ?? null;
  if (!String(caption || '').trim() && !String(transcript || '').trim()) {
    throw new Error('caption or transcript is required');
  }

  const res = await fetch('/api/editor/outreach/topic-line', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({ caption: caption ?? null, transcript: transcript ?? null }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Topic line failed (${res.status})`));
  return { topicLine: String(j?.topicLine || '').trim(), model: String(j?.model || '').trim() || 'deepseek-chat' };
}

export async function updateTarget(args: {
  token: string;
  id: string;
  patch: {
    sourcePostTranscript?: string | null;
    sourcePostVideoStorageBucket?: string | null;
    sourcePostVideoStoragePath?: string | null;
    sourcePostWhisperUsed?: boolean | null;
  };
  headers?: Record<string, string>;
}): Promise<void> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');
  const id = String(args.id || '').trim();
  if (!id) throw new Error('id is required');
  const patch = args.patch || {};
  const res = await fetch('/api/editor/outreach/update-target', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({ id, patch }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Update failed (${res.status})`));
}

export async function scrapeFollowing(args: {
  token: string;
  seedInstagramUrl: string;
  maxResults: number;
  maxSpendUsd: number;
  headers?: Record<string, string>;
}): Promise<{ seedUsername: string; items: ScrapeFollowingItem[]; sessionId?: string }> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');

  const seedInstagramUrl = String(args.seedInstagramUrl || '').trim();
  if (!seedInstagramUrl) throw new Error('seedInstagramUrl is required');

  const maxResults = Number(args.maxResults);
  const maxSpendUsd = Number(args.maxSpendUsd);

  const res = await fetch('/api/editor/outreach/scrape-following', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({ seedInstagramUrl, maxResults, maxSpendUsd }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Scrape failed (${res.status})`));

  const items = Array.isArray(j?.items) ? (j.items as any[]) : [];
  return {
    seedUsername: String(j?.seedUsername || '').trim(),
    items: items as ScrapeFollowingItem[],
    sessionId: typeof j?.sessionId === 'string' ? String(j.sessionId || '').trim() || undefined : undefined,
  };
}

export async function loadLatestFollowingScrapeSession(args: {
  token: string;
  headers?: Record<string, string>;
}): Promise<{
  session: null | {
    id: string;
    createdAt: string;
    seedInstagramUrl: string | null;
    seedUsername: string | null;
    maxResults: number | null;
    maxSpendUsd: number | null;
    actorId: string | null;
    items: ScrapeFollowingItem[];
  };
}> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');

  const res = await fetch('/api/editor/outreach/following-session/latest', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Load session failed (${res.status})`));
  const s = j?.session ?? null;
  if (!s?.id) return { session: null };
  return {
    session: {
      id: String(s.id),
      createdAt: String(s.createdAt || ''),
      seedInstagramUrl: typeof s.seedInstagramUrl === 'string' ? s.seedInstagramUrl : s.seedInstagramUrl ?? null,
      seedUsername: typeof s.seedUsername === 'string' ? s.seedUsername : s.seedUsername ?? null,
      maxResults: typeof s.maxResults === 'number' ? s.maxResults : s.maxResults ?? null,
      maxSpendUsd: typeof s.maxSpendUsd === 'number' ? s.maxSpendUsd : s.maxSpendUsd ?? null,
      actorId: typeof s.actorId === 'string' ? s.actorId : s.actorId ?? null,
      items: Array.isArray(s.items) ? (s.items as any[]) : [],
    } as any,
  };
}

export async function qualifyLite(args: {
  token: string;
  items: Array<Pick<ScrapeFollowingItem, 'username' | 'fullName' | 'profilePicUrl' | 'isVerified' | 'isPrivate' | 'raw'>>;
  headers?: Record<string, string>;
}): Promise<
  Array<
    | { username: string; ok: true; data: LiteQualification; model: string }
    | { username: string; ok: false; error: string }
  >
> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');
  const items = Array.isArray(args.items) ? args.items : [];
  if (!items.length) throw new Error('items is required');

  const res = await fetch('/api/editor/outreach/qualify-lite', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({ items }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Qualify failed (${res.status})`));
  return Array.isArray(j?.results) ? (j.results as any[]) : [];
}

export async function persistProspects(args: {
  token: string;
  seedInstagramUrl: string;
  seedUsername: string;
  baseTemplateId: string | null;
  items: Array<
    Pick<ScrapeFollowingItem, 'username' | 'fullName' | 'profilePicUrl' | 'isVerified' | 'isPrivate' | 'raw'> & {
      ai?: (LiteQualification & { model?: string | null; mode?: string | null }) | null;
    }
  >;
  headers?: Record<string, string>;
}): Promise<{ attempted: number; inserted: number }> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');

  const seedInstagramUrl = String(args.seedInstagramUrl || '').trim();
  const seedUsername = String(args.seedUsername || '').trim();
  if (!seedInstagramUrl) throw new Error('seedInstagramUrl is required');
  if (!seedUsername) throw new Error('seedUsername is required');

  const items = Array.isArray(args.items) ? args.items : [];
  if (!items.length) throw new Error('items is required');

  const res = await fetch('/api/editor/outreach/persist-prospects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({
      seedInstagramUrl,
      seedUsername,
      baseTemplateId: args.baseTemplateId ?? null,
      items,
    }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Save failed (${res.status})`));
  return { attempted: Number(j?.attempted || 0), inserted: Number(j?.inserted || 0) };
}

export async function enrichProspects(args: {
  token: string;
  seedUsername: string;
  usernames: string[];
  headers?: Record<string, string>;
}): Promise<Array<{ username: string; ok: true; profilePicUrlHD: string | null } | { username: string; ok: false; error: string }>> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');
  const seedUsername = String(args.seedUsername || '').trim();
  if (!seedUsername) throw new Error('seedUsername is required');
  const usernames = Array.isArray(args.usernames) ? args.usernames : [];
  if (!usernames.length) throw new Error('usernames is required');

  const res = await fetch('/api/editor/outreach/enrich-prospects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({ seedUsername, usernames }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Enrich failed (${res.status})`));
  return Array.isArray(j?.results) ? (j.results as any[]) : [];
}

export async function enrichQualifySaveFollowing(args: {
  token: string;
  seedInstagramUrl: string;
  seedUsername?: string | null;
  baseTemplateId: string | null;
  items: Array<Pick<ScrapeFollowingItem, 'username' | 'fullName' | 'profilePicUrl' | 'isVerified' | 'isPrivate' | 'raw'>>;
  headers?: Record<string, string>;
}): Promise<{ summary: EnrichQualifySaveSummary; results: EnrichQualifySaveRow[] }> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');
  const seedInstagramUrl = String(args.seedInstagramUrl || '').trim();
  if (!seedInstagramUrl) throw new Error('seedInstagramUrl is required');
  const items = Array.isArray(args.items) ? args.items : [];
  if (!items.length) throw new Error('items is required');

  const res = await fetch('/api/editor/outreach/enrich-qualify-save', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({
      seedInstagramUrl,
      seedUsername: typeof args.seedUsername === 'string' ? args.seedUsername : args.seedUsername ?? null,
      baseTemplateId: args.baseTemplateId ?? null,
      items,
    }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Enrich + Qualify + Save failed (${res.status})`));
  return {
    summary: j.summary as EnrichQualifySaveSummary,
    results: Array.isArray(j.results) ? (j.results as any[]) : [],
  };
}

export async function enrichQualifySaveFollowingStream(args: {
  token: string;
  seedInstagramUrl: string;
  seedUsername?: string | null;
  baseTemplateId: string | null;
  items: Array<Pick<ScrapeFollowingItem, 'username' | 'fullName' | 'profilePicUrl' | 'isVerified' | 'isPrivate' | 'raw'>>;
  headers?: Record<string, string>;
  onEvent?: (evt: EnrichQualifySaveStreamEvent) => void;
}): Promise<{ summary: EnrichQualifySaveSummary; results: EnrichQualifySaveRow[] }> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');
  const seedInstagramUrl = String(args.seedInstagramUrl || '').trim();
  if (!seedInstagramUrl) throw new Error('seedInstagramUrl is required');
  const items = Array.isArray(args.items) ? args.items : [];
  if (!items.length) throw new Error('items is required');

  let res: Response;
  try {
    res = await fetch('/api/editor/outreach/enrich-qualify-save', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(args.headers || {}),
      },
      body: JSON.stringify({
        stream: true,
        seedInstagramUrl,
        seedUsername: typeof args.seedUsername === 'string' ? args.seedUsername : args.seedUsername ?? null,
        baseTemplateId: args.baseTemplateId ?? null,
        items,
      }),
    });
  } catch (e: any) {
    const msg = String(e?.message || e || 'Failed to fetch');
    throw new Error(
      `Enrich + Qualify + Save failed to fetch (network). This usually means the server closed the connection or crashed before responding. Original: ${msg}`
    );
  }

  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(String(j?.error || `Enrich + Qualify + Save failed (${res.status})`));
  }
  if (!res.body) throw new Error('Response stream missing');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let finalPayload: { summary: EnrichQualifySaveSummary; results: EnrichQualifySaveRow[] } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // SSE frames are separated by blank lines.
    const frames = buf.split('\n\n');
    buf = frames.pop() || '';
    for (const frame of frames) {
      const line = frame
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('data:'));
      if (!line) continue;
      const raw = line.slice('data:'.length).trim();
      if (!raw) continue;
      let evt: any = null;
      try {
        evt = JSON.parse(raw);
      } catch {
        continue;
      }
      if (evt) args.onEvent?.(evt as EnrichQualifySaveStreamEvent);
      if (evt?.type === 'fatal') throw new Error(String(evt?.error || 'Failed'));
      if (evt?.type === 'final' && evt?.payload?.success) {
        finalPayload = { summary: evt.payload.summary, results: evt.payload.results };
      }
    }
  }

  if (!finalPayload) throw new Error('Stream ended without final payload');
  return finalPayload;
}

export async function getAlreadyEnrichedFollowingUsernames(args: {
  token: string;
  usernames: string[];
  headers?: Record<string, string>;
}): Promise<Set<string>> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');
  const usernames = Array.isArray(args.usernames) ? args.usernames : [];
  if (!usernames.length) return new Set();

  const res = await fetch('/api/editor/outreach/enriched-status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({ usernames }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Status failed (${res.status})`));
  const arr = Array.isArray(j?.enrichedUsernames) ? (j.enrichedUsernames as any[]) : [];
  return new Set(arr.map((u) => String(u || '').trim().toLowerCase()).filter(Boolean));
}

export async function hydrateFollowingFromDb(args: {
  token: string;
  usernames: string[];
  headers?: Record<string, string>;
}): Promise<
  Array<{
    username: string;
    ai: null | {
      score: number;
      niche: string | null;
      reason: string | null;
      has_offer: boolean | null;
      credential: string | null;
      model: string | null;
      mode: string | null;
      scoredAt: string | null;
    };
    enriched: { ok: boolean; enrichedAt: string | null; profilePicUrlHD: string | null; followingCount: number | null };
    sourcePostUrl?: string | null;
  }>
> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');
  const usernames = Array.isArray(args.usernames) ? args.usernames : [];
  if (!usernames.length) return [];

  const res = await fetch('/api/editor/outreach/following-hydrate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({ usernames }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Hydrate failed (${res.status})`));
  return Array.isArray(j?.rows) ? (j.rows as any[]) : [];
}

export type PipelineStage = 'todo' | 'dm_sent' | 'responded_needs_followup' | 'booked' | 'sent_contract' | 'closed';

export type PipelineLead = {
  id: string;
  username: string;
  fullName: string | null;
  profilePicUrl: string | null;
  profilePicUrlHD: string | null;
  aiScore: number | null;
  aiNiche: string | null;
  aiReason: string | null;
  aiHasOffer: boolean | null;
  aiCredential: string | null;
  enrichedAt: string | null;
  followingCount: number | null;
  pipelineStage: PipelineStage;
  pipelineAddedAt: string | null;
  lastContactDate: string | null; // YYYY-MM-DD
  sourcePostUrl: string | null;
  createdProjectId: string | null;
  createdTemplateId: string | null;
};

export async function pipelineBackfill(args: { token: string; headers?: Record<string, string> }): Promise<{ updated: number }> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');
  const res = await fetch('/api/editor/outreach/pipeline/backfill', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({}),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Backfill failed (${res.status})`));
  return { updated: Number(j?.updated || 0) };
}

export async function pipelineList(args: {
  token: string;
  q?: string | null;
  stage?: PipelineStage | null;
  headers?: Record<string, string>;
}): Promise<{ rows: PipelineLead[] }> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');
  const qp = new URLSearchParams();
  if (args.q) qp.set('q', String(args.q));
  if (args.stage) qp.set('stage', String(args.stage));
  const url = `/api/editor/outreach/pipeline/list${qp.toString() ? `?${qp.toString()}` : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `List failed (${res.status})`));
  return { rows: Array.isArray(j?.rows) ? (j.rows as any[]) : [] };
}

export async function pipelineAdd(args: {
  token: string;
  seedInstagramUrl: string;
  seedUsername: string;
  baseTemplateId?: string | null;
  row: {
    username: string;
    fullName?: string | null;
    profilePicUrl?: string | null;
    isVerified?: boolean | null;
    isPrivate?: boolean | null;
    raw?: any;
  };
  headers?: Record<string, string>;
}): Promise<{ applied: boolean }> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');
  const seedInstagramUrl = String(args.seedInstagramUrl || '').trim();
  const seedUsername = String(args.seedUsername || '').trim();
  if (!seedInstagramUrl) throw new Error('seedInstagramUrl is required');
  if (!seedUsername) throw new Error('seedUsername is required');
  const username = String(args.row?.username || '').trim();
  if (!username) throw new Error('row.username is required');
  const res = await fetch('/api/editor/outreach/pipeline/add', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({
      seedInstagramUrl,
      seedUsername,
      baseTemplateId: args.baseTemplateId ?? null,
      row: args.row,
    }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Add failed (${res.status})`));
  return { applied: !!j?.applied };
}

export async function pipelineUpdate(args: {
  token: string;
  username: string;
  patch: {
    pipelineStage?: PipelineStage | null;
    lastContactDate?: string | null;
    sourcePostUrl?: string | null;
    createdProjectId?: string | null;
    createdTemplateId?: string | null;
    projectCreatedAt?: string | null;
    baseTemplateId?: string | null;
  };
  headers?: Record<string, string>;
}): Promise<void> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');
  const username = String(args.username || '').trim();
  if (!username) throw new Error('username is required');
  const res = await fetch('/api/editor/outreach/pipeline/update', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({ username, patch: args.patch || {} }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Update failed (${res.status})`));
}

export async function pipelineStatus(args: {
  token: string;
  usernames: string[];
  headers?: Record<string, string>;
}): Promise<Set<string>> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');
  const usernames = Array.isArray(args.usernames) ? args.usernames : [];
  if (!usernames.length) return new Set();
  const res = await fetch('/api/editor/outreach/pipeline/status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({ usernames }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Status failed (${res.status})`));
  const arr = Array.isArray(j?.usernamesInPipeline) ? (j.usernamesInPipeline as any[]) : [];
  return new Set(arr.map((u) => String(u || '').trim().toLowerCase()).filter(Boolean));
}

export async function saveSourcePostUrlForUsername(args: {
  token: string;
  username: string;
  sourcePostUrl: string | null;
  seedInstagramUrl?: string | null;
  seedUsername?: string | null;
  baseTemplateId?: string | null;
  row?: {
    fullName?: string | null;
    profilePicUrl?: string | null;
    isVerified?: boolean | null;
    isPrivate?: boolean | null;
    raw?: any;
  };
  headers?: Record<string, string>;
}): Promise<void> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');
  const username = String(args.username || '').trim();
  if (!username) throw new Error('username is required');
  const res = await fetch('/api/editor/outreach/source-post-url', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({
      username,
      sourcePostUrl: typeof args.sourcePostUrl === 'string' ? args.sourcePostUrl : args.sourcePostUrl ?? null,
      seedInstagramUrl: args.seedInstagramUrl ?? null,
      seedUsername: args.seedUsername ?? null,
      baseTemplateId: args.baseTemplateId ?? null,
      row: args.row ?? null,
    }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Save failed (${res.status})`));
}

export async function markCreated(args: {
  token: string;
  seedUsername: string;
  prospectUsername: string;
  createdTemplateId: string;
  createdProjectId: string;
  baseTemplateId: string | null;
  headers?: Record<string, string>;
}): Promise<void> {
  const token = String(args.token || '').trim();
  if (!token) throw new Error('Missing auth token');

  const res = await fetch('/api/editor/outreach/mark-created', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(args.headers || {}),
    },
    body: JSON.stringify({
      seedUsername: args.seedUsername,
      prospectUsername: args.prospectUsername,
      createdTemplateId: args.createdTemplateId,
      createdProjectId: args.createdProjectId,
      baseTemplateId: args.baseTemplateId ?? null,
    }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(String(j?.error || `Mark created failed (${res.status})`));
}

