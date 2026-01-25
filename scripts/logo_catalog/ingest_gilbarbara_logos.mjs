/**
 * Phase G1 (manual): Ingest gilbarbara/logos catalog → public.editor_logo_catalog
 *
 * Source repo:
 * - https://github.com/gilbarbara/logos
 * - `logos.json` includes: name, shortname, url, files[]
 *
 * Spec for this provider:
 * - Provider/source: `gilbarbara`
 * - tags[]: [] (search-only; repo does not provide categories)
 * - variants: one per file in `files[]`
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/logo_catalog/ingest_gilbarbara_logos.mjs
 *
 * Optional:
 *   GITHUB_TOKEN=... (helps avoid GitHub rate limits in some environments)
 *   --insecure      (passes -k to curl if you have local CA issues)
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const SOURCE = 'gilbarbara';
const MANIFEST_URL = 'https://raw.githubusercontent.com/gilbarbara/logos/main/logos.json';
const RAW_BASE = 'https://raw.githubusercontent.com/gilbarbara/logos/main/logos';
// Category source (the "SVG Logos" platform)
const SVGPORN_DATASET_URL = 'https://storage.googleapis.com/logos-c87b5.appspot.com/logos.json';

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

function computeSearchText({ title, sourceKey, website, websiteDomain }) {
  const parts = [safeString(title), safeString(sourceKey), safeString(websiteDomain), safeString(website)].filter(Boolean);
  return parts.join(' ').toLowerCase();
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
  const GITHUB_TOKEN = safeString(process.env.GITHUB_TOKEN);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gilbarbara-'));
  const jsonPath = path.join(tmp, 'logos.json');
  const svgpornPath = path.join(tmp, 'svgporn.json');

  console.log(`⬇️ Downloading gilbarbara/logos manifest…`);
  const curlArgs = ['-L', ...(insecure ? ['-k'] : []), '-o', jsonPath, MANIFEST_URL];
  if (GITHUB_TOKEN) curlArgs.splice(1, 0, '-H', `Authorization: token ${GITHUB_TOKEN}`);
  execFileSync('curl', curlArgs, { stdio: 'inherit' });

  console.log(`⬇️ Downloading SVG Logos (svgporn) categories dataset…`);
  execFileSync('curl', ['-L', ...(insecure ? ['-k'] : []), '-o', svgpornPath, SVGPORN_DATASET_URL], { stdio: 'inherit' });

  const raw = fs.readFileSync(jsonPath, 'utf8');
  let items;
  try {
    items = JSON.parse(raw);
  } catch {
    die('Failed to parse downloaded logos.json as JSON');
  }
  if (!Array.isArray(items)) die('Unexpected manifest shape (expected a JSON array).');

  // Build categories-by-shortname from svgporn dataset.
  let svgporn = [];
  try {
    svgporn = JSON.parse(fs.readFileSync(svgpornPath, 'utf8'));
  } catch {
    // If this fails, we can still proceed (search-only) — but categories will be missing.
    svgporn = [];
  }
  const categoriesBySlug = new Map();
  if (Array.isArray(svgporn)) {
    for (const it of svgporn) {
      const slug = safeString(it?.shortname || '').toLowerCase();
      if (!slug) continue;
      const cats = Array.isArray(it?.categories) ? it.categories.map((c) => safeString(c)).filter(Boolean) : [];
      if (!cats.length) continue;
      categoriesBySlug.set(slug, cats);
    }
  }

  console.log(`🔎 Manifest entries: ${items.length}`);
  console.log(`🏷️  Category map entries (svgporn): ${categoriesBySlug.size}`);

  // Deduplicate by source_key in case upstream has collisions (rare, but safe).
  const byKey = new Map();
  let duplicateKeys = 0;
  let skipped = 0;
  let totalVariants = 0;

  for (const it of items) {
    const title = safeString(it?.name || '');
    const sourceKey = safeString(it?.shortname || '').toLowerCase();
    const website = safeString(it?.url || '') || null;
    const websiteDomain = parseWebsiteDomain(website);
    const categories = categoriesBySlug.get(sourceKey) || [];
    const files = Array.isArray(it?.files) ? it.files.map((f) => safeString(f)).filter(Boolean) : [];
    if (!title || !sourceKey || files.length === 0) {
      skipped++;
      continue;
    }

    const variants = files.map((filename) => ({
      variant_key: filename,
      remote_url: `${RAW_BASE}/${encodeURIComponent(filename)}`,
      format: filename.toLowerCase().endsWith('.svg') ? 'svg' : 'other',
    }));

    const existing = byKey.get(sourceKey) || null;
    if (existing) duplicateKeys++;

    const mergedTitle = safeString(existing?.title) || title;
    const mergedWebsite = safeString(existing?.website) || website;
    const mergedWebsiteDomain = existing?.website_domain || websiteDomain;

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
      tags: categories, // categories from the SVG Logos platform (if available)
      variants: mergedVariants,
      updated_at: new Date().toISOString(),
    });
  }

  const rows = Array.from(byKey.values()).map((r) => {
    const variants = Array.isArray(r.variants) ? r.variants : [];
    totalVariants += variants.length;
    return {
      ...r,
      search_text: computeSearchText({
        title: r.title,
        sourceKey: r.source_key,
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

  console.log(`\n✅ Done. Catalog source='${SOURCE}' now contains ~${rows.length} rows.`);
  console.log(`Tip: rerun anytime (idempotent upsert).`);
}

main().catch((e) => die(e?.message || String(e)));

