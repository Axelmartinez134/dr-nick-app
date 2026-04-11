#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

function parseArgs(argv) {
  const args = {
    inputPath: "",
    accountId: process.env.EDITOR_ACCOUNT_ID || "",
  };

  for (let idx = 0; idx < argv.length; idx += 1) {
    const token = argv[idx];
    const next = argv[idx + 1];
    if (token === "--input" && next) {
      args.inputPath = path.resolve(process.cwd(), next);
      idx += 1;
    } else if (token === "--account-id" && next) {
      args.accountId = String(next || "").trim();
      idx += 1;
    } else if (token === "--help" || token === "-h") {
      printHelpAndExit(0);
    }
  }

  return args;
}

function printHelpAndExit(code) {
  console.log(`Import batch thread network classifications into outreach targets

Usage:
  node scripts/instagram_dm/import_thread_network_classifications.mjs --account-id <uuid> --input path/to/batch_results.json

Options:
  --account-id  Required. Account UUID to scope updates
  --input       Required. batch_results.json path produced by the batch runner
`);
  process.exit(code);
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

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
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

async function loadClassificationDetails(runDir) {
  const absRunDir = path.resolve(REPO_ROOT, runDir);
  const filePath = path.join(absRunDir, "classification_result.json");
  try {
    const parsed = await readJson(filePath);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function main() {
  await loadLocalEnvFiles();
  const args = parseArgs(process.argv.slice(2));

  const accountId = String(args.accountId || "").trim();
  if (!accountId) {
    throw new Error("Missing account id. Pass --account-id <uuid> or set EDITOR_ACCOUNT_ID.");
  }
  if (!args.inputPath) {
    throw new Error("Missing input. Pass --input path/to/batch_results.json");
  }

  const supabase = getSupabaseAdminClient();
  const results = await readJson(args.inputPath);
  if (!Array.isArray(results)) {
    throw new Error(`Expected ${args.inputPath} to contain a JSON array.`);
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (let idx = 0; idx < results.length; idx += 1) {
    const row = results[idx] || {};
    const leadId = String(row?.lead_id || "").trim();
    const username = String(row?.username || "").trim();
    const label = `[${idx + 1}/${results.length}] ${username || leadId || "unknown"}`;

    if (!row?.ok || !leadId || !row?.run_dir) {
      skipped += 1;
      console.log(`${label} -> SKIP`);
      continue;
    }

    const classification = await loadClassificationDetails(String(row.run_dir || ""));
    const patch = {
      instagram_dm_thread_last_state:
        typeof classification?.classification_state === "string"
          ? classification.classification_state.trim()
          : typeof row?.classification_state === "string"
            ? row.classification_state.trim()
            : null,
      instagram_dm_thread_last_recommended_action:
        typeof classification?.recommended_action === "string"
          ? classification.recommended_action.trim()
          : typeof row?.recommended_action === "string"
            ? row.recommended_action.trim()
            : null,
      instagram_dm_thread_last_classified_at:
        typeof classification?.classified_at === "string" && classification.classified_at.trim()
          ? classification.classified_at.trim()
          : typeof row?.completed_at === "string" && row.completed_at.trim()
            ? row.completed_at.trim()
            : new Date().toISOString(),
      instagram_dm_thread_last_run_artifact_path: String(row.run_dir || "").trim() || null,
    };

    if (!patch.instagram_dm_thread_last_state || !patch.instagram_dm_thread_last_recommended_action) {
      skipped += 1;
      console.log(`${label} -> SKIP -> missing classification fields`);
      continue;
    }

    try {
      const { data, error } = await supabase
        .from("editor_outreach_targets")
        .update(patch)
        .eq("account_id", accountId)
        .eq("id", leadId)
        .select("id");

      if (error) {
        throw new Error(error.message);
      }

      if (!Array.isArray(data) || data.length === 0) {
        failed += 1;
        console.log(`${label} -> FAIL -> no matching outreach row updated for supplied account_id`);
        continue;
      }

      imported += 1;
      console.log(
        `${label} -> IMPORTED -> state=${patch.instagram_dm_thread_last_state} action=${patch.instagram_dm_thread_last_recommended_action}`
      );
    } catch (error) {
      failed += 1;
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`${label} -> FAIL -> ${msg}`);
    }
  }

  console.log("");
  console.log(`Import complete. imported=${imported} skipped=${skipped} failed=${failed}`);
}

main().catch((error) => {
  console.error("");
  console.error("Import thread network classifications failed before completion.");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
