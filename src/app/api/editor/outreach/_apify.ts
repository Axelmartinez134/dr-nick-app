import 'server-only';

import { ApifyClient } from 'apify-client';

export type InstagramProfileScrape = {
  fullName: string | null;
  username: string | null;
  profilePicUrlHD: string | null;
  raw: any;
};

export type InstagramFollowingProspect = {
  seedUsername: string;
  username: string | null;
  fullName: string | null;
  profilePicUrl: string | null;
  isVerified: boolean | null;
  isPrivate: boolean | null;
  raw: any;
};

export type InstagramReelScrape = {
  reelUrl: string;
  shortcode: string | null;
  ownerUsername: string | null;
  ownerFullName: string | null;
  caption: string | null;
  transcript: string | null;
  downloadedVideoUrl: string | null;
  raw: any;
};

function requireApifyToken(): string {
  const t = String(process.env.APIFY_API_TOKEN || '').trim();
  if (!t) throw new Error('Server missing APIFY_API_TOKEN');
  return t;
}

function firstString(v: any): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
}

function isPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function boolOrNull(v: any): boolean | null {
  if (v === true) return true;
  if (v === false) return false;
  return null;
}

function extractInstagramUsername(instagramUrlOrUsername: string): string | null {
  const raw = String(instagramUrlOrUsername || '').trim();
  if (!raw) return null;
  // If user pasted a URL, try to extract the first path segment.
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const u = new URL(raw);
      const seg = String(u.pathname || '')
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean)[0];
      if (!seg) return null;
      // Basic sanitation: IG usernames are alnum/._ only (we keep it permissive).
      return seg;
    } catch {
      return null;
    }
  }
  // Otherwise assume it's already a username.
  return raw.replace(/^@+/, '').trim() || null;
}

function extractInstagramShortcode(postOrReelUrl: string): string | null {
  const raw = String(postOrReelUrl || '').trim();
  if (!raw) return null;
  if (!(raw.startsWith('http://') || raw.startsWith('https://'))) return null;
  try {
    const u = new URL(raw);
    const parts = String(u.pathname || '')
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);
    // Supports /p/<shortcode>/, /reel/<shortcode>/, /tv/<shortcode>/
    const kind = parts[0];
    if (kind !== 'p' && kind !== 'reel' && kind !== 'tv' && kind !== 'reels') return null;
    return parts[1] || null;
  } catch {
    return null;
  }
}

function canonicalizeInstagramPostOrReelUrl(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (!(raw.startsWith('http://') || raw.startsWith('https://'))) return raw;
  try {
    const u = new URL(raw);
    // Drop query + hash to avoid accidental variants.
    u.search = '';
    u.hash = '';
    const parts = String(u.pathname || '')
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts[0] === 'reels') parts[0] = 'reel';
    // Ensure trailing slash for consistency.
    u.pathname = `/${parts.join('/')}${parts.length ? '/' : ''}`;
    return u.toString();
  } catch {
    return raw;
  }
}

export async function scrapeInstagramProfileViaApify(args: { instagramUrl: string }): Promise<InstagramProfileScrape> {
  const instagramUrl = String(args.instagramUrl || '').trim();
  if (!instagramUrl) throw new Error('instagramUrl is required');

  const token = requireApifyToken();
  const client = new ApifyClient({ token });

  // Actor: https://apify.com/apify/instagram-profile-scraper
  const actorId = 'apify/instagram-profile-scraper';

  // Minimal input: the actor supports usernames, ids, or URLs.
  // We pass URLs so UX is simplest.
  const username = extractInstagramUsername(instagramUrl);
  if (!username) throw new Error('Could not parse Instagram username from URL');

  // Actor input schema (as of 2026) requires `usernames`.
  // It accepts usernames, ids, or profile URLs in that array; we pass the normalized username.
  const input: any = { usernames: [username] };

  const run = await client.actor(actorId).call(input, {
    // Keep these bounded so the editor doesn’t hang forever.
    // The actor typically returns quickly for 1 profile.
    waitSecs: 90,
    timeout: 90,
    memory: 1024,
  });

  const datasetId = (run as any)?.defaultDatasetId;
  if (!datasetId) {
    throw new Error('Apify run returned no dataset id');
  }

  const { items } = await client.dataset(datasetId).listItems({ limit: 1 });
  const raw = Array.isArray(items) ? items[0] : null;
  if (!raw) throw new Error('Apify dataset returned no items');

  // Some profiles don't include HD; fall back to the best available image URL.
  const profilePicUrlHD =
    firstString(raw?.profilePicUrlHD) ||
    firstString(raw?.profilePicUrlHd) ||
    firstString(raw?.profilePicUrl) ||
    firstString(raw?.profile_pic_url_hd) ||
    firstString(raw?.profile_pic_url) ||
    null;

  return {
    fullName: firstString(raw?.fullName),
    username: firstString(raw?.username),
    profilePicUrlHD,
    raw,
  };
}

export async function scrapeInstagramReelViaApify(args: {
  reelUrl: string;
  includeTranscript?: boolean;
  includeDownloadedVideo?: boolean;
}): Promise<InstagramReelScrape> {
  const reelUrlRaw = String(args.reelUrl || '').trim();
  if (!reelUrlRaw) throw new Error('reelUrl is required');
  if (!(reelUrlRaw.startsWith('http://') || reelUrlRaw.startsWith('https://'))) {
    throw new Error('reelUrl must be a full URL');
  }
  const reelUrl = canonicalizeInstagramPostOrReelUrl(reelUrlRaw);

  const token = requireApifyToken();
  const client = new ApifyClient({ token });

  // Actor: https://apify.com/apify/instagram-reel-scraper
  const actorId = 'apify/instagram-reel-scraper';

  // Actor input schema uses a `username` array, but it accepts reel URLs as items.
  const input: any = {
    username: [reelUrl],
    // We only need one reel when URL is provided.
    resultsLimit: 1,
    includeTranscript: args.includeTranscript !== false,
    includeDownloadedVideo: !!args.includeDownloadedVideo,
  };

  const run = await client.actor(actorId).call(input, {
    waitSecs: 180,
    timeout: 180,
    memory: 1024,
  });

  const datasetId = (run as any)?.defaultDatasetId;
  if (!datasetId) throw new Error('Apify run returned no dataset id');

  const { items } = await client.dataset(datasetId).listItems({ limit: 1 });
  const raw = Array.isArray(items) ? items[0] : null;
  if (!raw) throw new Error('Apify dataset returned no items');

  const shortcode = firstString(raw?.shortCode ?? raw?.shortcode ?? raw?.short_code) || extractInstagramShortcode(reelUrl);

  return {
    reelUrl: firstString(raw?.url) || reelUrl,
    shortcode,
    ownerUsername: firstString(raw?.ownerUsername ?? raw?.owner_username),
    ownerFullName: firstString(raw?.ownerFullName ?? raw?.owner_full_name),
    caption: firstString(raw?.caption),
    transcript: firstString(raw?.transcript),
    downloadedVideoUrl: firstString(raw?.downloadedVideo ?? raw?.downloaded_video),
    raw,
  };
}

export async function scrapeInstagramFollowingViaApify(args: {
  seedInstagramUrlOrUsername: string;
  maxResults?: number;
  maxSpendUsd?: number;
}): Promise<{ seedUsername: string; items: InstagramFollowingProspect[] }> {
  const seedRaw = String(args.seedInstagramUrlOrUsername || '').trim();
  if (!seedRaw) throw new Error('seedInstagramUrlOrUsername is required');

  const seedUsername = extractInstagramUsername(seedRaw);
  if (!seedUsername) throw new Error('Could not parse Instagram username from URL');

  const maxResults = Number.isFinite(args.maxResults as any) ? Number(args.maxResults) : 100;
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 5000) {
    throw new Error('maxResults must be an integer in [1,5000]');
  }

  const maxSpendUsd = Number.isFinite(args.maxSpendUsd as any) ? Number(args.maxSpendUsd) : 5;
  if (!Number.isFinite(maxSpendUsd) || maxSpendUsd < 0.5 || maxSpendUsd > 5) {
    throw new Error('maxSpendUsd must be a number in [0.5,5.0]');
  }

  const token = requireApifyToken();
  const client = new ApifyClient({ token });

  // Actor: https://apify.com/datavoyantlab/instagram-following-scraper
  // NOTE: This actor’s input schema only supports `usernames`.
  const actorId = 'datavoyantlab/instagram-following-scraper';
  const input: any = { usernames: [seedUsername] };

  const run = await client.actor(actorId).call(input, {
    waitSecs: 180,
    timeout: 180,
    memory: 1024,
    // Platform-level safety rail: hard cap spend for the run.
    // This is the real protection since the actor does not expose a `limit` input.
    maxTotalChargeUsd: maxSpendUsd,
  } as any);

  const datasetId = (run as any)?.defaultDatasetId;
  if (!datasetId) {
    throw new Error('Apify run returned no dataset id');
  }

  const { items } = await client.dataset(datasetId).listItems({ limit: maxResults });
  const rows = Array.isArray(items) ? items : [];

  const normalized: InstagramFollowingProspect[] = rows.map((raw: any) => {
    // Actor output can vary; prefer `following_user`, but fall back to other shapes.
    const followingUser = raw?.following_user ?? raw?.followingUser ?? null;
    const u = isPlainObject(followingUser)
      ? (followingUser as any)
      : isPlainObject(raw?.user)
        ? (raw.user as any)
        : isPlainObject(raw)
          ? (raw as any)
          : {};

    // Avoid accidentally using the seed username from a top-level `username` field (the actor includes it).
    const candidateUsername =
      (isPlainObject(followingUser) ? firstString((followingUser as any)?.username) : null) ||
      firstString(u?.username) ||
      firstString(raw?.following_username ?? raw?.followingUsername) ||
      null;
    const username = candidateUsername && candidateUsername !== seedUsername ? candidateUsername : candidateUsername;

    const fullName =
      firstString(u?.full_name ?? u?.fullName ?? u?.name) ||
      (isPlainObject(followingUser) ? firstString((followingUser as any)?.full_name ?? (followingUser as any)?.fullName) : null) ||
      null;

    const profilePicUrl =
      firstString(u?.profile_pic_url ?? u?.profilePicUrl ?? u?.profilePicUrlHD ?? u?.profile_pic_url_hd) ||
      (isPlainObject(followingUser)
        ? firstString((followingUser as any)?.profile_pic_url ?? (followingUser as any)?.profilePicUrl)
        : null) ||
      null;

    const isVerified = boolOrNull(u?.is_verified ?? u?.isVerified ?? raw?.is_verified ?? raw?.isVerified);
    const isPrivate = boolOrNull(u?.is_private ?? u?.isPrivate ?? raw?.is_private ?? raw?.isPrivate);
    return {
      seedUsername,
      username,
      fullName,
      profilePicUrl,
      isVerified,
      isPrivate,
      raw,
    };
  });

  return { seedUsername, items: normalized };
}

