/**
 * Phase 3B (manual): Ingest VectorLogoZone catalog → public.editor_logo_catalog
 *
 * What it does:
 * - Downloads the VectorLogoZone repo ZIP (main)
 * - Parses `www/logos/<slug>/index.md` frontmatter for:
 *   - title, logohandle (slug), website, tags[], images[] (variants)
 * - Upserts rows into `public.editor_logo_catalog` with:
 *   - source='vectorlogozone'
 *   - source_key=<logohandle>
 *   - title, website, website_domain, tags, variants, search_text
 * - Prints a summary report (logo count, variant count, top tags)
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/logo_catalog/ingest_vectorlogozone.mjs
 *
 * Optional:
 *   GITHUB_TOKEN=... (to avoid GitHub rate limits)
 *   --insecure      (passes -k to curl if you have local CA issues)
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const SOURCE = 'vectorlogozone';
const REPO_ZIP = 'https://github.com/VectorLogoZone/vectorlogozone/archive/refs/heads/main.zip';

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

function parseFrontmatter(md) {
  const s = String(md || '');
  if (!s.startsWith('---')) return null;
  const end = s.indexOf('\n---', 3);
  if (end < 0) return null;
  const fm = s.slice(3, end).trimEnd();
  return fm;
}

/**
 * Minimal YAML parser for the specific fields we need.
 * We only support:
 * - scalar: key: value
 * - list:
 *     key:
 *     - item
 *     - item2
 */
function parseNeededYamlFields(frontmatter) {
  const out = { title: null, logohandle: null, website: null, tags: [], images: [] };
  const lines = String(frontmatter || '').split('\n');

  const isListItem = (line) => /^\s*-\s+/.test(line);
  const parseKey = (line) => {
    const m = /^([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(line);
    if (!m) return null;
    return { key: m[1], rest: m[2] ?? '' };
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const kv = parseKey(line);
    if (!kv) {
      i++;
      continue;
    }

    const key = kv.key;
    const rest = kv.rest;
    if (key === 'title' || key === 'logohandle' || key === 'website') {
      const v = safeString(rest).replace(/^['"]|['"]$/g, '');
      out[key] = v || null;
      i++;
      continue;
    }

    if (key === 'tags' || key === 'images') {
      const arr = [];
      // If inline yaml list e.g. tags: [a, b] (rare), handle best-effort
      const inline = safeString(rest);
      if (inline.startsWith('[') && inline.endsWith(']')) {
        const inner = inline.slice(1, -1);
        for (const part of inner.split(',')) {
          const v = safeString(part).replace(/^['"]|['"]$/g, '');
          if (v) arr.push(v);
        }
        out[key] = arr;
        i++;
        continue;
      }

      // Otherwise read subsequent "- item" lines
      i++;
      while (i < lines.length && isListItem(lines[i])) {
        const item = safeString(lines[i].replace(/^\s*-\s+/, '')).replace(/^['"]|['"]$/g, '');
        if (item) arr.push(item);
        i++;
      }
      out[key] = arr;
      continue;
    }

    i++;
  }

  return out;
}

function listSvgFilesInLogoDir(logoDir) {
  try {
    return fs
      .readdirSync(logoDir, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((name) => name.toLowerCase().endsWith('.svg'))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function buildVariants({ folderSlug, imagesFromFrontmatter, logoDirOnDisk }) {
  const fromFm = Array.isArray(imagesFromFrontmatter)
    ? imagesFromFrontmatter.map((x) => safeString(x)).filter(Boolean)
    : [];

  // Many VLZ logos don't declare `images:` in index.md, but still have SVGs in the folder
  // (e.g., `www/logos/airtable/airtable-icon.svg`). Fallback to scanning the folder.
  const filenames = fromFm.length ? fromFm : listSvgFilesInLogoDir(logoDirOnDisk);

  return filenames.map((filename) => ({
    variant_key: filename, // stable
    remote_url: `https://raw.githubusercontent.com/VectorLogoZone/vectorlogozone/main/www/logos/${encodeURIComponent(
      folderSlug
    )}/${encodeURIComponent(filename)}`,
    format: filename.toLowerCase().endsWith('.svg') ? 'svg' : 'other',
  }));
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

function listIndexFiles(rootDir) {
  const logosDir = path.join(rootDir, 'www', 'logos');
  if (!fs.existsSync(logosDir)) return [];
  const slugs = fs
    .readdirSync(logosDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const files = [];
  for (const slug of slugs) {
    const p = path.join(logosDir, slug, 'index.md');
    if (fs.existsSync(p)) files.push({ slug, path: p });
  }
  return files;
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

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vlz-'));
  const zipPath = path.join(tmp, 'vlz.zip');
  const unzipDir = path.join(tmp, 'unzipped');
  fs.mkdirSync(unzipDir, { recursive: true });

  console.log(`⬇️ Downloading VectorLogoZone repo zip…`);
  const curlArgs = [
    '-L',
    ...(insecure ? ['-k'] : []),
    '-o',
    zipPath,
    REPO_ZIP,
  ];
  // If a token is provided, use it to reduce rate limiting for GitHub downloads.
  // (Works for github.com zip downloads too.)
  const GITHUB_TOKEN = safeString(process.env.GITHUB_TOKEN);
  const curlEnv = { ...process.env };
  if (GITHUB_TOKEN) {
    curlEnv.CURL_CA_BUNDLE = curlEnv.CURL_CA_BUNDLE || '';
  }
  execFileSync('curl', curlArgs, { stdio: 'inherit', env: curlEnv });

  console.log(`📦 Unzipping…`);
  execFileSync('unzip', ['-q', zipPath, '-d', unzipDir], { stdio: 'inherit' });

  // Repo zip expands into `vectorlogozone-main/`
  const repoRoot = path.join(unzipDir, 'vectorlogozone-main');
  if (!fs.existsSync(repoRoot)) die(`Unexpected zip layout; missing ${repoRoot}`);

  const indexFiles = listIndexFiles(repoRoot);
  if (!indexFiles.length) die('No www/logos/*/index.md files found.');

  console.log(`🔎 Found ${indexFiles.length} logos (index.md files). Parsing…`);

  const rows = [];
  const tagCounts = new Map();
  let totalVariants = 0;
  let skipped = 0;

  for (const f of indexFiles) {
    const raw = fs.readFileSync(f.path, 'utf-8');
    const fm = parseFrontmatter(raw);
    if (!fm) {
      skipped++;
      continue;
    }
    const parsed = parseNeededYamlFields(fm);
    const title = parsed?.title || null;
    const sourceKey = parsed?.logohandle || f.slug;
    const website = parsed?.website || null;
    const websiteDomain = parseWebsiteDomain(website);
    const tags = Array.isArray(parsed?.tags) ? parsed.tags.filter(Boolean) : [];
    const logoDirOnDisk = path.dirname(f.path);
    const variants = buildVariants({
      folderSlug: f.slug,
      imagesFromFrontmatter: parsed?.images || [],
      logoDirOnDisk,
    });

    totalVariants += variants.length;
    for (const t of tags) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);

    if (!title || !sourceKey) {
      skipped++;
      continue;
    }

    const searchText = computeSearchText({ title, sourceKey, tags, website, websiteDomain });
    rows.push({
      source: SOURCE,
      source_key: sourceKey,
      title,
      website,
      website_domain: websiteDomain,
      tags,
      variants,
      search_text: searchText,
      updated_at: new Date().toISOString(),
    });
  }

  console.log(`🧾 Parsed rows: ${rows.length} (skipped ${skipped}). Total variants: ${totalVariants}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Upsert in chunks to avoid payload limits.
  const CHUNK = 250;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('editor_logo_catalog')
      .upsert(chunk, { onConflict: 'source,source_key' });
    if (error) die(`Supabase upsert failed: ${error.message}`);
    upserted += chunk.length;
    if (upserted % 1000 === 0 || upserted === rows.length) {
      console.log(`✅ Upserted ${upserted}/${rows.length}`);
    }
  }

  console.log(`\n📊 Top tags (by logo count):`);
  for (const [tag, count] of topNCounts(tagCounts, 20)) {
    console.log(`- ${tag}: ${count}`);
  }

  console.log(`\n✅ Done. Catalog source='${SOURCE}' now contains ~${rows.length} rows.`);
  console.log(`Tip: rerun anytime (idempotent upsert).`);
}

main().catch((e) => die(e?.message || String(e)));

