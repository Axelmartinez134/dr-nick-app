#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_DEBUGGER_URL,
  connectToBrowser,
  ensureDir,
  getSupabaseAdminClient,
  loadLeadRowByUsername,
  loadLeadRowsFromDb,
  loadLeads,
  loadLocalEnvFiles,
  normalizeUsername,
  pickLead,
  runResolvedLeadNetworkPipeline,
} from "./thread_network_pipeline_lib.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const DEFAULT_LEADS_PATH = path.join(__dirname, "test_leads.json");
const DEFAULT_OUTPUT_DIR = path.join(__dirname, "output");

function parseArgs(argv) {
  const args = {
    debuggerUrl: DEFAULT_DEBUGGER_URL,
    leadsPath: DEFAULT_LEADS_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
    accountId: process.env.EDITOR_ACCOUNT_ID || "",
    leadId: "",
    username: "",
    threadUrl: "",
    runLabel: "",
  };

  for (let idx = 0; idx < argv.length; idx += 1) {
    const token = argv[idx];
    const next = argv[idx + 1];

    if (token === "--debugger-url" && next) {
      args.debuggerUrl = next;
      idx += 1;
    } else if (token === "--leads" && next) {
      args.leadsPath = path.resolve(process.cwd(), next);
      idx += 1;
    } else if (token === "--output-dir" && next) {
      args.outputDir = path.resolve(process.cwd(), next);
      idx += 1;
    } else if (token === "--account-id" && next) {
      args.accountId = String(next || "").trim();
      idx += 1;
    } else if (token === "--lead-id" && next) {
      args.leadId = String(next || "").trim();
      idx += 1;
    } else if (token === "--username" && next) {
      args.username = normalizeUsername(next);
      idx += 1;
    } else if (token === "--thread-url" && next) {
      args.threadUrl = String(next || "").trim();
      idx += 1;
    } else if (token === "--run-label" && next) {
      args.runLabel = String(next || "").trim();
      idx += 1;
    } else if (token === "--help" || token === "-h") {
      printHelpAndExit(0);
    }
  }

  return args;
}

function printHelpAndExit(code) {
  console.log(`Instagram DM one-thread network pipeline

Usage:
  node scripts/instagram_dm/run_thread_network_pipeline.mjs --account-id <uuid> [--lead-id uuid] [--username handle] [--thread-url url] [--run-label name]

Options:
  --account-id    Required. Account UUID whose outreach rows should be read
  --lead-id       Optional. Run for one exact lead id
  --username      Optional. Run for one exact username
  --thread-url    Optional. Override the stored thread URL with an exact thread URL
  --run-label     Optional. Extra label appended to the run folder name
  --leads         JSON file containing an array of lead objects with ids/usernames
  --output-dir    Base folder where run artifacts and the run index are written
  --debugger-url  Existing Chrome DevTools endpoint

What it does:
  This is the higher-throughput path for one thread:
  capture -> analyze -> classify

Artifacts are written into a dedicated per-run folder instead of shared overwrite files.
`);
  process.exit(code);
}

async function resolveTarget({ supabase, accountId, leadsPath, leadId, username }) {
  const leads = await loadLeads(leadsPath);
  const selectedLead = pickLead(leads, { leadId, username });
  let selectedRow = null;

  if (selectedLead) {
    const dbRowsById = await loadLeadRowsFromDb({
      supabase,
      accountId,
      ids: [selectedLead.id],
    });
    selectedRow = dbRowsById.get(selectedLead.id) || null;
  } else if (username) {
    selectedRow = await loadLeadRowByUsername({
      supabase,
      accountId,
      username,
    });
    if (!selectedRow) {
      throw new Error(`No outreach row matched --username ${username} for account ${accountId}`);
    }
  } else {
    throw new Error("Could not resolve a lead target.");
  }

  const resolvedUsername =
    normalizeUsername(selectedRow?.prospect_username) ||
    normalizeUsername(selectedRow?.username) ||
    selectedLead?.username ||
    username;
  const resolvedLeadId = String(selectedLead?.id || selectedRow?.id || "").trim();

  return {
    leads,
    selectedLead,
    selectedRow,
    resolvedUsername,
    resolvedLeadId,
  };
}

async function main() {
  await loadLocalEnvFiles(REPO_ROOT);
  const args = parseArgs(process.argv.slice(2));
  const accountId = String(args.accountId || "").trim();
  if (!accountId) {
    throw new Error("Missing account id. Pass --account-id <uuid> or set EDITOR_ACCOUNT_ID.");
  }

  const outputDir = path.resolve(args.outputDir);
  const runIndexPath = path.join(outputDir, "network_pipeline_run_index.jsonl");

  await ensureDir(outputDir);

  const supabase = getSupabaseAdminClient();
  const target = await resolveTarget({
    supabase,
    accountId,
    leadsPath: args.leadsPath,
    leadId: args.leadId,
    username: args.username,
  });

  const username = target.resolvedUsername;
  const leadId = target.resolvedLeadId;
  const row = target.selectedRow;

  const browser = await connectToBrowser(args.debuggerUrl);

  try {
    console.log(`Loaded ${target.leads.length} leads from ${args.leadsPath}`);
    console.log(`Connected to Chrome via ${args.debuggerUrl}`);
    console.log(`Target lead: ${username} (${leadId || "no-local-lead-id"})`);
    const result = await runResolvedLeadNetworkPipeline({
      browser,
      outputDir,
      runIndexPath,
      leadId,
      username,
      row,
      threadUrlOverride: args.threadUrl,
      runLabel: args.runLabel,
      projectRoot: process.cwd(),
    });

    console.log(`Artifacts written under ${result.run_dir}`);
    console.log(`Run index appended to ${path.relative(process.cwd(), runIndexPath)}`);

    if (!result.ok) {
      throw new Error(result.error_reason || "Pipeline run failed.");
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("");
  console.error("Instagram one-thread network pipeline failed before completion.");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
