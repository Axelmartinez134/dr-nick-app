/**
 * Phase L1 (manual): Ingest Lobe Icons catalog → public.editor_logo_catalog
 *
 * What it does:
 * - Downloads the Lobe Icons repo ZIP (master)
 * - Reads per-icon metadata from `src/<IconKey>/index.md` frontmatter:
 *   - title, group (Provider|Model|Application), description (website URL)
 * - Reads all static SVG variants from `packages/static-svg/icons/*.svg`
 *   - Filenames are deterministic (from upstream build script): `${key.toLowerCase()}(-suffix...).svg`
 * - Upserts rows into `public.editor_logo_catalog` with:
 *   - source='lobe-icons'
 *   - source_key=<iconKeyLower> (matches static svg filename prefix)
 *   - title, website, website_domain, tags=['provider'|'model'|'application'], variants, search_text
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/logo_catalog/ingest_lobe_icons.mjs
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

const SOURCE = 'lobe-icons';
const REPO_ZIP = 'https://github.com/lobehub/lobe-icons/archive/refs/heads/master.zip';

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
  return s.slice(3, end).trimEnd();
}

/**
 * Minimal YAML parser for the specific scalar fields we need.
 * We only support: `key: value` scalar lines (no nested objects needed here).
 */
function parseNeededYamlFields(frontmatter) {
  const out = { title: null, group: null, description: null };
  const lines = String(frontmatter || '').split('\n');
  for (const line of lines) {
    const m = /^([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    const rest = safeString(m[2] ?? '').replace(/^['"]|['"]$/g, '');
    if (key === 'title' || key === 'group' || key === 'description') {
      out[key] = rest || null;
    }
  }
  return out;
}

function normalizeGroupToTag(group) {
  const g = safeString(group).toLowerCase();
  if (g === 'provider' || g === 'model' || g === 'application') return g;
  return null;
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

function listDirs(p) {
  try {
    return fs
      .readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function listFiles(p) {
  try {
    return fs
      .readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function buildMetaMap(repoRoot) {
  const srcDir = path.join(repoRoot, 'src');
  const dirs = listDirs(srcDir);
  const metaByKey = new Map();
  let missingIndex = 0;

  for (const dirName of dirs) {
    const p = path.join(srcDir, dirName, 'index.md');
    if (!fs.existsSync(p)) {
      missingIndex++;
      continue;
    }
    const raw = fs.readFileSync(p, 'utf8');
    const fm = parseFrontmatter(raw);
    const parsed = fm ? parseNeededYamlFields(fm) : null;
    const keyLower = dirName.toLowerCase();
    metaByKey.set(keyLower, {
      title: parsed?.title || null,
      groupTag: normalizeGroupToTag(parsed?.group),
      website: parsed?.description || null,
    });
  }

  return { metaByKey, missingIndex, srcDirs: dirs.length };
}

function buildVariantsByBaseKey(repoRoot) {
  const iconsDir = path.join(repoRoot, 'packages', 'static-svg', 'icons');
  if (!fs.existsSync(iconsDir)) die(`Missing expected directory: ${iconsDir}`);

  const svgFiles = listFiles(iconsDir).filter((n) => n.toLowerCase().endsWith('.svg'));
  const byBase = new Map();

  for (const filename of svgFiles) {
    const m = /^([a-z0-9]+)(?:-.+)?\.svg$/i.exec(filename);
    if (!m) continue;
    const baseKey = safeString(m[1]).toLowerCase();
    if (!baseKey) continue;
    const arr = byBase.get(baseKey) || [];
    arr.push(filename);
    byBase.set(baseKey, arr);
  }

  for (const [k, arr] of byBase.entries()) {
    arr.sort((a, b) => a.localeCompare(b));
    byBase.set(k, arr);
  }

  return { iconsDir, byBase, svgFilesCount: svgFiles.length };
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

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lobe-icons-'));
  const zipPath = path.join(tmp, 'lobe-icons.zip');
  const unzipDir = path.join(tmp, 'unzipped');
  fs.mkdirSync(unzipDir, { recursive: true });

  console.log(`⬇️ Downloading Lobe Icons repo zip…`);
  const curlArgs = ['-L', ...(insecure ? ['-k'] : []), '-o', zipPath, REPO_ZIP];
  const curlEnv = { ...process.env };
  if (GITHUB_TOKEN) {
    // For GitHub zip downloads, a token mainly helps with rate limiting in some environments.
    // We send it as an Authorization header via curl -H.
    curlArgs.splice(1, 0, '-H', `Authorization: token ${GITHUB_TOKEN}`);
  }
  execFileSync('curl', curlArgs, { stdio: 'inherit', env: curlEnv });

  console.log(`📦 Unzipping…`);
  execFileSync('unzip', ['-q', zipPath, '-d', unzipDir], { stdio: 'inherit' });

  // Repo zip expands into `lobe-icons-master/`
  const repoRoot = path.join(unzipDir, 'lobe-icons-master');
  if (!fs.existsSync(repoRoot)) die(`Unexpected zip layout; missing ${repoRoot}`);

  const { metaByKey, missingIndex, srcDirs } = buildMetaMap(repoRoot);
  const { byBase, svgFilesCount } = buildVariantsByBaseKey(repoRoot);

  console.log(`🔎 src dirs: ${srcDirs} (missing index.md: ${missingIndex})`);
  console.log(`🧾 static svg files: ${svgFilesCount}; base keys: ${byBase.size}`);

  const rows = [];
  let totalVariants = 0;
  let withGroupTag = 0;

  for (const [sourceKey, filenames] of byBase.entries()) {
    const meta = metaByKey.get(sourceKey) || null;
    const title = safeString(meta?.title) || sourceKey;
    const website = safeString(meta?.website) || null;
    const websiteDomain = parseWebsiteDomain(website);
    const groupTag = meta?.groupTag || null;
    const tags = groupTag ? [groupTag] : [];
    if (groupTag) withGroupTag++;

    const variants = filenames.map((filename) => ({
      variant_key: filename, // stable
      remote_url: `https://raw.githubusercontent.com/lobehub/lobe-icons/master/packages/static-svg/icons/${encodeURIComponent(
        filename
      )}`,
      format: 'svg',
    }));
    totalVariants += variants.length;

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

  console.log(`🧾 Rows: ${rows.length}. Total variants: ${totalVariants}. Rows w/ group tag: ${withGroupTag}`);

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

