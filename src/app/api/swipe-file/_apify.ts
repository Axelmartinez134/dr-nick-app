import 'server-only';

import { ApifyClient } from 'apify-client';

function requireApifyToken(): string {
  const t = String(process.env.APIFY_API_TOKEN || '').trim();
  if (!t) throw new Error('Server missing APIFY_API_TOKEN');
  return t;
}

export async function scrapeYoutubeViaApifyKaramelo(args: { videoUrl: string }): Promise<any> {
  const videoUrl = String(args.videoUrl || '').trim();
  if (!videoUrl) throw new Error('videoUrl is required');
  if (!(videoUrl.startsWith('http://') || videoUrl.startsWith('https://'))) {
    throw new Error('videoUrl must be a full URL');
  }

  const token = requireApifyToken();
  const client = new ApifyClient({ token });

  const actorId = 'karamelo/youtube-transcripts';

  const input: any = {
    outputFormat: 'captions',
    urls: [videoUrl],
    maxRetries: 8,
    channelNameBoolean: true,
    channelIDBoolean: true,
    datePublishedBoolean: true,
    thumbnailBoolean: true,
    descriptionBoolean: true,
    keywordsBoolean: true,
    viewCountBoolean: true,
    likesBoolean: true,
    commentsBoolean: true,
    proxyOptions: { useApifyProxy: true },
  };

  const run = await client.actor(actorId).call(input, { waitSecs: 180, timeout: 180, memory: 1024 });
  const datasetId = (run as any)?.defaultDatasetId;
  if (!datasetId) throw new Error('Apify run returned no dataset id');

  const { items } = await client.dataset(datasetId).listItems({ limit: 1 });
  const raw: any = Array.isArray(items) ? (items as any[])[0] : null;
  if (!raw) throw new Error('Apify dataset returned no items');

  return raw;
}

