/**
 * Phase SI1 (manual): Ingest simple-icons catalog → public.editor_logo_catalog
 *
 * Source repo:
 * - https://github.com/simple-icons/simple-icons (default branch: develop)
 * - Dataset: `data/simple-icons.json` (array of icons)
 *   - fields: title, slug, hex, source, aliases?, license?, guidelines?
 * - SVGs: `icons/<slug>.svg`
 *
 * Spec for this provider:
 * - Provider/source: `simple-icons`
 * - tags[]: [] (search-only; dataset has no categories)
 * - variants: one per icon (the SVG for the slug)
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/logo_catalog/ingest_simple_icons.mjs
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

const SOURCE = 'simple-icons';
const DATA_URL = 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/data/simple-icons.json';
const RAW_SVG_BASE = 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons';
const SLUGS_URL = 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/slugs.md';

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

function computeSearchText({ title, sourceKey, website, websiteDomain, aliases }) {
  const parts = [
    safeString(title),
    safeString(sourceKey),
    ...(Array.isArray(aliases) ? aliases.map((a) => safeString(a)) : []),
    safeString(websiteDomain),
    safeString(website),
  ].filter(Boolean);
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

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'simple-icons-'));
  const jsonPath = path.join(tmp, 'simple-icons.json');
  const slugsPath = path.join(tmp, 'slugs.md');

  console.log(`⬇️ Downloading simple-icons dataset…`);
  const curlArgs = ['-L', ...(insecure ? ['-k'] : []), '-o', jsonPath, DATA_URL];
  if (GITHUB_TOKEN) curlArgs.splice(1, 0, '-H', `Authorization: token ${GITHUB_TOKEN}`);
  execFileSync('curl', curlArgs, { stdio: 'inherit' });

  console.log(`⬇️ Downloading simple-icons slugs table…`);
  execFileSync('curl', ['-L', ...(insecure ? ['-k'] : []), '-o', slugsPath, SLUGS_URL], { stdio: 'inherit' });

  let items;
  try {
    items = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch {
    die('Failed to parse downloaded simple-icons.json as JSON');
  }
  if (!Array.isArray(items)) die('Unexpected dataset shape (expected a JSON array).');

  // Build title -> slug mapping from slugs.md (Simple Icons official source of truth).
  const slugByTitle = new Map();
  try {
    const md = fs.readFileSync(slugsPath, 'utf8');
    for (const line of md.split('\n')) {
      const t = line.trim();
      if (!t.startsWith('|')) continue;
      // Skip header/separator rows
      if (t.includes(':---')) continue;
      const m = /^\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/.exec(t);
      if (!m) continue;
      const rawTitle = safeString(m[1]).replace(/^`|`$/g, '');
      const rawSlug = safeString(m[2]).replace(/^`|`$/g, '');
      if (!rawTitle || !rawSlug) continue;
      slugByTitle.set(rawTitle, rawSlug);
    }
  } catch {
    // best-effort; if missing, we still try `it.slug` (but dataset usually lacks it)
  }

  console.log(`🔎 Dataset entries: ${items.length}`);
  console.log(`🔎 Slugs table entries: ${slugByTitle.size}`);

  const byKey = new Map();
  let duplicateKeys = 0;
  let skipped = 0;
  let totalVariants = 0;

  for (const it of items) {
    const title = safeString(it?.title || '');
    // Most dataset entries omit `slug`. Use slugs.md mapping (authoritative).
    const slug = safeString(it?.slug || slugByTitle.get(title) || '').toLowerCase();
    const website = safeString(it?.source || '') || null;
    const websiteDomain = parseWebsiteDomain(website);

    // aliases can be a string[] or an object with 'aka' etc; we accept any strings we see.
    const aliasesRaw = it?.aliases;
    const aliases = Array.isArray(aliasesRaw)
      ? aliasesRaw.map((a) => safeString(a)).filter(Boolean)
      : aliasesRaw && typeof aliasesRaw === 'object'
        ? Object.values(aliasesRaw)
            .flat()
            .map((a) => safeString(a))
            .filter(Boolean)
        : [];

    if (!title || !slug) {
      skipped++;
      continue;
    }

    const filename = `${slug}.svg`;
    const variants = [
      {
        variant_key: filename,
        remote_url: `${RAW_SVG_BASE}/${encodeURIComponent(filename)}`,
        format: 'svg',
      },
    ];

    const existing = byKey.get(slug) || null;
    if (existing) duplicateKeys++;

    byKey.set(slug, {
      source: SOURCE,
      source_key: slug,
      title,
      website,
      website_domain: websiteDomain,
      tags: [],
      variants,
      search_text: computeSearchText({ title, sourceKey: slug, website, websiteDomain, aliases }),
      updated_at: new Date().toISOString(),
    });
    totalVariants += 1;
  }

  const rows = Array.from(byKey.values());

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

