import 'server-only';

import { ApifyClient } from 'apify-client';

export type InstagramProfileScrape = {
  fullName: string | null;
  username: string | null;
  profilePicUrlHD: string | null;
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

  return {
    fullName: firstString(raw?.fullName),
    username: firstString(raw?.username),
    profilePicUrlHD: firstString(raw?.profilePicUrlHD),
    raw,
  };
}

