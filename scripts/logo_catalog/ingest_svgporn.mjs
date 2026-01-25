/**
 * Phase S1 (manual): Ingest SVG Logos (svgporn/svglogos.dev) catalog → public.editor_logo_catalog
 *
 * Data source:
 * - https://storage.googleapis.com/logos-c87b5.appspot.com/logos.json
 *   - entries include: name, shortname, url, files[], categories[], tags[] (we IGNORE tags per spec)
 *
 * Spec:
 * - Provider/source: `svgporn`
 * - tags[]: categories ONLY (exactly as provided by the dataset; no normalization)
 * - variants: one per file in `files[]`
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/logo_catalog/ingest_svgporn.mjs
 *
 * Optional:
 *   --insecure      (passes -k to curl if you have local CA issues)
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const SOURCE = 'svgporn';
const DATASET_URL = 'https://storage.googleapis.com/logos-c87b5.appspot.com/logos.json';
const CDN_BASE = 'https://cdn.svglogos.dev/logos';

function die(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function safeString(v) {
  return String(v ?? '').trim();
}

function parseWebsiteDomain(website) {
  const s = safeString(website);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.hostname || null;
  } catch {
    return null;
  }
}

function computeSearchText({ title, sourceKey, tags, website, websiteDomain }) {
  const parts = [
    safeString(title),
    safeString(sourceKey),
    ...(Array.isArray(tags) ? tags.map((t) => safeString(t)) : []),
    safeString(websiteDomain),
    safeString(website),
  ].filter(Boolean);
  return parts.join(' ').toLowerCase();
}

function topNCounts(map, n) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

async function main() {
  const SUPABASE_URL = safeString(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const SUPABASE_SERVICE_ROLE_KEY = safeString(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE
  );
  if (!SUPABASE_URL) die('Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).');
  if (!SUPABASE_SERVICE_ROLE_KEY) die('Missing SUPABASE_SERVICE_ROLE_KEY.');

  const insecure = process.argv.includes('--insecure');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svgporn-'));
  const jsonPath = path.join(tmp, 'logos.json');

  console.log(`⬇️ Downloading svgporn dataset…`);
  const curlArgs = ['-L', ...(insecure ? ['-k'] : []), '-o', jsonPath, DATASET_URL];
  execFileSync('curl', curlArgs, { stdio: 'inherit' });

  const raw = fs.readFileSync(jsonPath, 'utf8');
  let items;
  try {
    items = JSON.parse(raw);
  } catch {
    die('Failed to parse downloaded logos.json as JSON');
  }
  if (!Array.isArray(items)) die('Unexpected dataset shape (expected a JSON array).');

  console.log(`🔎 Dataset entries: ${items.length}`);

  // Deduplicate by source_key to avoid inserting the same (source, source_key) twice in one upsert,
  // which Postgres rejects with: "ON CONFLICT DO UPDATE command cannot affect row a second time".
  // If duplicates exist, we merge variants + categories.
  const byKey = new Map();
  const catCounts = new Map();
  let totalVariants = 0;
  let skipped = 0;
  let duplicateKeys = 0;

  for (const it of items) {
    const title = safeString(it?.name || '');
    const sourceKey = safeString(it?.shortname || '').toLowerCase();
    const website = safeString(it?.url || '') || null;
    const websiteDomain = parseWebsiteDomain(website);

    const categories = Array.isArray(it?.categories) ? it.categories.map((c) => safeString(c)).filter(Boolean) : [];
    // Spec: categories only (no tags[] from dataset)
    const files = Array.isArray(it?.files) ? it.files.map((f) => safeString(f)).filter(Boolean) : [];
    if (!title || !sourceKey || files.length === 0) {
      skipped++;
      continue;
    }

    const variants = files.map((filename) => ({
      variant_key: filename,
      remote_url: `${CDN_BASE}/${encodeURIComponent(filename)}`,
      format: filename.toLowerCase().endsWith('.svg') ? 'svg' : 'other',
    }));

    const existing = byKey.get(sourceKey) || null;
    if (existing) duplicateKeys++;

    const mergedTitle = safeString(existing?.title) || title;
    const mergedWebsite = safeString(existing?.website) || website;
    const mergedWebsiteDomain = existing?.website_domain || websiteDomain;

    const tagSet = new Set([...(existing?.tags || []), ...categories].map((t) => safeString(t)).filter(Boolean));
    const mergedTags = Array.from(tagSet);

    const variantByKey = new Map();
    for (const v of Array.isArray(existing?.variants) ? existing.variants : []) {
      const k = safeString(v?.variant_key);
      if (k) variantByKey.set(k, v);
    }
    for (const v of variants) {
      const k = safeString(v?.variant_key);
      if (k && !variantByKey.has(k)) variantByKey.set(k, v);
    }
    const mergedVariants = Array.from(variantByKey.values());

    byKey.set(sourceKey, {
      source: SOURCE,
      source_key: sourceKey,
      title: mergedTitle,
      website: mergedWebsite || null,
      website_domain: mergedWebsiteDomain,
      tags: mergedTags,
      variants: mergedVariants,
      updated_at: new Date().toISOString(),
    });
  }

  const rows = Array.from(byKey.values()).map((r) => {
    const tags = Array.isArray(r.tags) ? r.tags : [];
    for (const t of tags) catCounts.set(t, (catCounts.get(t) || 0) + 1);
    const variants = Array.isArray(r.variants) ? r.variants : [];
    totalVariants += variants.length;
    return {
      ...r,
      search_text: computeSearchText({
        title: r.title,
        sourceKey: r.source_key,
        tags,
        website: r.website,
        websiteDomain: r.website_domain,
      }),
    };
  });

  console.log(
    `🧾 Rows: ${rows.length} (skipped ${skipped}). Total variants: ${totalVariants}. Duplicate source_keys merged: ${duplicateKeys}`
  );

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const CHUNK = 250;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from('editor_logo_catalog').upsert(chunk, { onConflict: 'source,source_key' });
    if (error) die(`Supabase upsert failed: ${error.message}`);
    upserted += chunk.length;
    if (upserted % 1000 === 0 || upserted === rows.length) console.log(`✅ Upserted ${upserted}/${rows.length}`);
  }

  console.log(`\n📊 Top categories (by logo count):`);
  for (const [cat, count] of topNCounts(catCounts, 20)) console.log(`- ${cat}: ${count}`);

  console.log(`\n✅ Done. Catalog source='${SOURCE}' now contains ~${rows.length} rows.`);
  console.log(`Tip: rerun anytime (idempotent upsert).`);
}

main().catch((e) => die(e?.message || String(e)));

