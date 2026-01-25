/**
 * Phase D1 (manual): Ingest developer-icons catalog → public.editor_logo_catalog
 *
 * Provider: https://github.com/xandemon/developer-icons
 *
 * Notes:
 * - This repo is mostly a flat list of optimized `icons/*.svg` files (plus `icons/raw/`).
 * - Categories exist (as used by their site) in `lib/iconsData.ts`:
 *   - `categoriesData` (list of category names)
 *   - `iconsData[]` per icon: { id, name, path, categories[], keywords[], url }
 * - We ingest those categories into `tags[]` using **Title Case exactly as the source provides**
 *   (e.g. "Frontend", "DevOps & AI/ML").
 * - Each SVG becomes one catalog row with one variant.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/logo_catalog/ingest_developer_icons.mjs
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
import vm from 'node:vm';

const SOURCE = 'developer-icons';
const REPO_ZIP = 'https://github.com/xandemon/developer-icons/archive/refs/heads/main.zip';

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

function computeSearchText({ title, sourceKey, tags, website, websiteDomain, keywords }) {
  const parts = [
    safeString(title),
    safeString(sourceKey),
    ...(Array.isArray(tags) ? tags.map((t) => safeString(t)) : []),
    ...(Array.isArray(keywords) ? keywords.map((k) => safeString(k)) : []),
    safeString(websiteDomain),
    safeString(website),
  ].filter(Boolean);
  return parts.join(' ').toLowerCase();
}

function listSvgFiles(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((n) => n.toLowerCase().endsWith('.svg'))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function extractArrayLiteral(tsSource, exportName) {
  const s = String(tsSource || '');
  const idx = s.indexOf(`export const ${exportName}`);
  if (idx < 0) return null;
  // `export const iconsData: IconDataType[] = [` contains `[]` in the type annotation.
  // We must find the `=` first, then the array literal `[` after it.
  const eq = s.indexOf('=', idx);
  if (eq < 0) return null;
  const bracketStart = s.indexOf('[', eq);
  if (bracketStart < 0) return null;

  let i = bracketStart;
  let depth = 0;
  let inStr = null;
  let esc = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (; i < s.length; i++) {
    const ch = s[i];
    const next = i + 1 < s.length ? s[i + 1] : '';

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === '\\') {
        esc = true;
        continue;
      }
      if (ch === inStr) {
        inStr = null;
        continue;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
      continue;
    }

    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) {
        return s.slice(bracketStart, i + 1);
      }
    }
  }
  return null;
}

function evalArrayLiteral(arrayLiteral) {
  if (!arrayLiteral) return null;
  try {
    return vm.runInNewContext(`(${arrayLiteral})`, {});
  } catch {
    return null;
  }
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

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'developer-icons-'));
  const zipPath = path.join(tmp, 'developer-icons.zip');
  const unzipDir = path.join(tmp, 'unzipped');
  fs.mkdirSync(unzipDir, { recursive: true });

  console.log(`⬇️ Downloading developer-icons repo zip…`);
  const curlArgs = ['-L', ...(insecure ? ['-k'] : []), '-o', zipPath, REPO_ZIP];
  if (GITHUB_TOKEN) {
    curlArgs.splice(1, 0, '-H', `Authorization: token ${GITHUB_TOKEN}`);
  }
  execFileSync('curl', curlArgs, { stdio: 'inherit' });

  console.log(`📦 Unzipping…`);
  execFileSync('unzip', ['-q', zipPath, '-d', unzipDir], { stdio: 'inherit' });

  // Repo zip expands into `developer-icons-main/`
  const repoRoot = path.join(unzipDir, 'developer-icons-main');
  if (!fs.existsSync(repoRoot)) die(`Unexpected zip layout; missing ${repoRoot}`);

  const iconsDir = path.join(repoRoot, 'icons');
  if (!fs.existsSync(iconsDir)) die(`Missing expected directory: ${iconsDir}`);

  const svgFiles = listSvgFiles(iconsDir).filter((n) => n.toLowerCase() !== 'developer-icons.svg');
  console.log(`🔎 Found ${svgFiles.length} optimized SVGs in icons/ (excluding icons/raw).`);

  const iconsDataPath = path.join(repoRoot, 'lib', 'iconsData.ts');
  if (!fs.existsSync(iconsDataPath)) die(`Missing expected metadata file: ${iconsDataPath}`);
  const iconsDataTs = fs.readFileSync(iconsDataPath, 'utf8');
  const iconsDataLiteral = extractArrayLiteral(iconsDataTs, 'iconsData');
  const parsedIconsData = evalArrayLiteral(iconsDataLiteral);
  if (!Array.isArray(parsedIconsData) || parsedIconsData.length === 0) {
    die(`Failed to parse iconsData[] from lib/iconsData.ts`);
  }

  const rows = [];
  const available = new Set(svgFiles.map((n) => n.toLowerCase()));
  let missingSvg = 0;
  let skipped = 0;
  for (const it of parsedIconsData) {
    const id = safeString(it?.id || '');
    const name = safeString(it?.name || '');
    const relPath = safeString(it?.path || '');
    const website = safeString(it?.url || '') || null;
    const categories = Array.isArray(it?.categories) ? it.categories.map((c) => safeString(c)).filter(Boolean) : [];
    const keywords = Array.isArray(it?.keywords) ? it.keywords.map((k) => safeString(k)).filter(Boolean) : [];
    if (!id || !relPath) {
      skipped++;
      continue;
    }
    if (id.toLowerCase() === 'developer-icons') continue; // skip the project logo
    if (!relPath.toLowerCase().startsWith('icons/')) {
      skipped++;
      continue;
    }
    if (relPath.toLowerCase().includes('/raw/')) continue; // ignore raw source svgs
    const filename = path.posix.basename(relPath);
    if (!available.has(filename.toLowerCase())) {
      missingSvg++;
      continue;
    }

    const sourceKey = id.toLowerCase();
    const title = name || sourceKey;
    const websiteDomain = parseWebsiteDomain(website);
    const tags = categories; // Title Case exactly as source provides (per user choice)

    const variants = [
      {
        variant_key: filename,
        remote_url: `https://raw.githubusercontent.com/xandemon/developer-icons/main/icons/${encodeURIComponent(filename)}`,
        format: 'svg',
      },
    ];

    rows.push({
      source: SOURCE,
      source_key: sourceKey,
      title,
      website,
      website_domain: websiteDomain,
      tags,
      variants,
      search_text: computeSearchText({ title, sourceKey, tags, website, websiteDomain, keywords }),
      updated_at: new Date().toISOString(),
    });
  }

  console.log(
    `🧾 Rows: ${rows.length}. Total variants: ${rows.length}. (Tags from categories; missingSvg=${missingSvg} skipped=${skipped})`
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

