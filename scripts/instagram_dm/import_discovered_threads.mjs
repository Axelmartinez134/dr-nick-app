#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const DEFAULT_INPUT_PATH = path.join(__dirname, "output", "results.json");
const DEFAULT_LEADS_PATH = path.join(__dirname, "test_leads.json");

function parseArgs(argv) {
  const args = {
    inputPath: DEFAULT_INPUT_PATH,
    leadsPath: DEFAULT_LEADS_PATH,
    accountId: process.env.EDITOR_ACCOUNT_ID || "",
    legacyUserId: process.env.EDITOR_LEGACY_USER_ID || "",
  };

  for (let idx = 0; idx < argv.length; idx += 1) {
    const token = argv[idx];
    const next = argv[idx + 1];
    if (token === "--input" && next) {
      args.inputPath = path.resolve(process.cwd(), next);
      idx += 1;
    } else if (token === "--leads" && next) {
      args.leadsPath = path.resolve(process.cwd(), next);
      idx += 1;
    } else if (token === "--account-id" && next) {
      args.accountId = String(next || "").trim();
      idx += 1;
    } else if (token === "--legacy-user-id" && next) {
      args.legacyUserId = String(next || "").trim();
      idx += 1;
    } else if (token === "--help" || token === "-h") {
      printHelpAndExit(0);
    }
  }

  return args;
}

function printHelpAndExit(code) {
  console.log(`Import discovered Instagram DM threads into outreach targets

Usage:
  node scripts/instagram_dm/import_discovered_threads.mjs --account-id <uuid> [--legacy-user-id <uuid>] [--input path] [--leads path]

Options:
  --account-id      Required. Account UUID to scope updates
  --legacy-user-id  Optional. Also update legacy rows with account_id IS NULL and created_by_user_id = this user
  --input           results.json path (defaults to scripts/instagram_dm/output/results.json)
  --leads           lead mapping JSON path (defaults to scripts/instagram_dm/test_leads.json)
`);
  process.exit(code);
}

function normalizeUsername(value) {
  return String(value || "").trim().replace(/^@+/, "").toLowerCase();
}

function deriveThreadIdFromUrl(url) {
  const raw = String(url || "").trim();
  const match = raw.match(/\/direct\/t\/([^/?#]+)/i);
  return match ? String(match[1] || "").trim() : "";
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx <= 0) return null;

  const key = trimmed.slice(0, eqIdx).trim();
  let value = trimmed.slice(eqIdx + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

async function loadLocalEnvFiles() {
  const candidates = [".env.local", ".env"];
  for (const name of candidates) {
    const filePath = path.join(REPO_ROOT, name);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      for (const line of raw.split(/\r?\n/)) {
        const parsed = parseEnvLine(line);
        if (!parsed) continue;
        if (process.env[parsed.key] === undefined) {
          process.env[parsed.key] = parsed.value;
        }
      }
    } catch {
      // Ignore missing local env files.
    }
  }
}

async function loadResults(inputPath) {
  const raw = await fs.readFile(inputPath, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected ${inputPath} to contain a JSON array.`);
  }
  return parsed;
}

async function loadLeadIndex(leadsPath) {
  try {
    const raw = await fs.readFile(leadsPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`Expected ${leadsPath} to contain a JSON array.`);
    }

    const byUsername = new Map();
    for (const row of parsed) {
      const username = normalizeUsername(row?.username);
      const id = String(row?.id || "").trim();
      if (!username || !id) continue;
      const arr = byUsername.get(username) || [];
      arr.push(id);
      byUsername.set(username, arr);
    }
    return byUsername;
  } catch (error) {
    const message = String(error?.message || error || "");
    if (message.includes("ENOENT")) {
      return new Map();
    }
    throw error;
  }
}

function getSupabaseAdminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE ||
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!url || !key) {
    throw new Error(
      "Missing Supabase service role env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or equivalent aliases)."
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function buildUsernameMatch(uname, columnName) {
  const unameAt = `@${uname}`;
  return [
    `${columnName}.eq.${uname}`,
    `${columnName}.eq.${unameAt}`,
    `${columnName}.ilike.${uname}`,
    `${columnName}.ilike.${unameAt}`,
  ].join(",");
}

async function updateByIds({ supabase, accountId, ids, patch }) {
  const uniqueIds = Array.from(new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || "").trim()).filter(Boolean)));
  if (!uniqueIds.length) return 0;

  const { data, error } = await supabase
    .from("editor_outreach_targets")
    .update(patch)
    .eq("account_id", accountId)
    .in("id", uniqueIds)
    .select("id");

  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data.length : 0;
}

async function updateLegacyByUsername({ supabase, legacyUserId, uname, patch }) {
  if (!legacyUserId) return 0;

  const filters = [
    buildUsernameMatch(uname, "username"),
    buildUsernameMatch(uname, "prospect_username"),
  ];

  const updatedIds = new Set();

  for (const filter of filters) {
    const { data, error } = await supabase
      .from("editor_outreach_targets")
      .update(patch)
      .is("account_id", null)
      .eq("created_by_user_id", legacyUserId)
      .or(filter)
      .select("id");

    if (error) {
      throw new Error(error.message);
    }

    for (const row of Array.isArray(data) ? data : []) {
      const id = String(row?.id || "").trim();
      if (id) updatedIds.add(id);
    }
  }

  return updatedIds.size;
}

async function main() {
  await loadLocalEnvFiles();
  const args = parseArgs(process.argv.slice(2));

  const accountId = String(args.accountId || "").trim();
  if (!accountId) {
    throw new Error("Missing account id. Pass --account-id <uuid> or set EDITOR_ACCOUNT_ID.");
  }

  const legacyUserId = String(args.legacyUserId || "").trim();
  const supabase = getSupabaseAdminClient();
  const results = await loadResults(args.inputPath);
  const leadIndex = await loadLeadIndex(args.leadsPath);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (let idx = 0; idx < results.length; idx += 1) {
    const row = results[idx] || {};
    const username = normalizeUsername(row.username);
    const success = row.success === true;
    const verificationPassed = row.verification_passed === true;
    const threadUrl = String(row.thread_url || "").trim();
    const threadId = deriveThreadIdFromUrl(threadUrl);
    const label = `[${idx + 1}/${results.length}] ${username || "unknown"}`;

    if (!username || !success || !verificationPassed || !threadUrl || !threadId) {
      skipped += 1;
      console.log(`${label} -> SKIP`);
      continue;
    }

    const patch = {
      instagram_dm_thread_url: threadUrl,
      instagram_dm_thread_id: threadId,
      instagram_dm_thread_discovered_at:
        typeof row.timestamp === "string" && row.timestamp.trim()
          ? row.timestamp.trim()
          : new Date().toISOString(),
    };

    try {
      const leadIds = leadIndex.get(username) || [];
      if (!leadIds.length) {
        failed += 1;
        console.log(`${label} -> FAIL -> username not found in leads mapping file`);
        continue;
      }

      const accountCount = await updateByIds({
        supabase,
        accountId,
        ids: leadIds,
        patch,
      });

      const legacyCount = await updateLegacyByUsername({
        supabase,
        legacyUserId,
        uname: username,
        patch,
      });

      if (accountCount === 0 && legacyCount === 0) {
        failed += 1;
        console.log(`${label} -> FAIL -> no matching outreach rows updated for supplied account_id`);
        continue;
      }

      imported += 1;
      console.log(
        `${label} -> IMPORTED -> account_rows=${accountCount}${
          legacyUserId ? ` legacy_rows=${legacyCount}` : ""
        } -> ${threadUrl}`
      );
    } catch (error) {
      failed += 1;
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`${label} -> FAIL -> ${msg}`);
    }
  }

  console.log("");
  console.log(
    `Import complete. imported=${imported} skipped=${skipped} failed=${failed}`
  );
}

main().catch((error) => {
  console.error("");
  console.error("Import discovered threads failed before completion.");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
