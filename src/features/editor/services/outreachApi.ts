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
}): Promise<{ seedUsername: string; items: ScrapeFollowingItem[] }> {
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

