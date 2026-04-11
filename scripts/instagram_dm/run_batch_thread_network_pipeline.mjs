#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_DEBUGGER_URL,
  appendJsonLine,
  connectToBrowser,
  ensureDir,
  getSupabaseAdminClient,
  loadLeadRowsFromDb,
  loadLeads,
  loadLocalEnvFiles,
  normalizeUsername,
  runResolvedLeadNetworkPipeline,
  saveJson,
  slugify,
  timestampSlug,
} from "./thread_network_pipeline_lib.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const DEFAULT_LEADS_PATH = path.join(__dirname, "test_leads.json");
const DEFAULT_OUTPUT_DIR = path.join(__dirname, "output");
const DEFAULT_DELAY_MS = 1500;

function parseArgs(argv) {
  const args = {
    debuggerUrl: DEFAULT_DEBUGGER_URL,
    leadsPath: DEFAULT_LEADS_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
    accountId: process.env.EDITOR_ACCOUNT_ID || "",
    limit: 0,
    offset: 0,
    delayMs: DEFAULT_DELAY_MS,
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
    } else if (token === "--limit" && next) {
      args.limit = Math.max(0, Number.parseInt(next, 10) || 0);
      idx += 1;
    } else if (token === "--offset" && next) {
      args.offset = Math.max(0, Number.parseInt(next, 10) || 0);
      idx += 1;
    } else if (token === "--delay-ms" && next) {
      args.delayMs = Math.max(0, Number.parseInt(next, 10) || 0);
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
  console.log(`Instagram DM batch network pipeline

Usage:
  node scripts/instagram_dm/run_batch_thread_network_pipeline.mjs --account-id <uuid> [--leads path] [--limit n] [--offset n] [--delay-ms n] [--run-label name]

Options:
  --account-id    Required. Account UUID whose outreach rows should be read
  --leads         JSON file containing an array of lead objects with ids/usernames
  --limit         Optional. Max number of leads to process after offset
  --offset        Optional. Skip the first N leads from the input file
  --delay-ms      Optional. Delay between leads in milliseconds (default: 1500)
  --run-label     Optional. Extra label appended to the batch folder and per-lead run folders
  --output-dir    Base folder where batch artifacts and per-lead artifacts are written
  --debugger-url  Existing Chrome DevTools endpoint

What it does:
  This is the higher-throughput batch path over the proven one-thread pipeline:
  resolve -> capture -> analyze -> classify

Behavior:
  - one shared browser connection
  - one fresh page per lead
  - continue on error by default
  - per-lead artifacts are preserved
  - batch summary files are written incrementally
`);
  process.exit(code);
}

function buildBatchId(runLabel) {
  const parts = [timestampSlug(), slugify(runLabel || "batch")];
  return parts.filter(Boolean).join("-");
}

function selectLeads(leads, { offset, limit }) {
  const sliced = leads.slice(offset);
  return limit > 0 ? sliced.slice(0, limit) : sliced;
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function summarizeBatch(results, context) {
  const successCount = results.filter((item) => item.ok).length;
  const failureCount = results.length - successCount;

  return {
    batch_id: context.batchId,
    batch_dir: context.batchDir,
    leads_path: context.leadsPath,
    account_id: context.accountId,
    selected_lead_count: context.selectedLeadCount,
    processed_lead_count: results.length,
    success_count: successCount,
    failure_count: failureCount,
    offset: context.offset,
    limit: context.limit,
    delay_ms: context.delayMs,
    started_at: context.startedAt,
    updated_at: new Date().toISOString(),
    classification_counts: countBy(results, (item) => item.classification_state),
    recommended_action_counts: countBy(results, (item) => item.recommended_action),
    resolution_source_counts: countBy(results, (item) => item.resolution_source),
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
  const batchesDir = path.join(outputDir, "network_batches");
  const runIndexPath = path.join(outputDir, "network_pipeline_run_index.jsonl");

  await ensureDir(outputDir);
  await ensureDir(batchesDir);

  const allLeads = await loadLeads(args.leadsPath);
  const selectedLeads = selectLeads(allLeads, {
    offset: args.offset,
    limit: args.limit,
  });

  if (!selectedLeads.length) {
    throw new Error("No leads remained after applying offset/limit.");
  }

  const batchId = buildBatchId(args.runLabel);
  const batchDirAbs = path.join(batchesDir, batchId);
  const batchDir = path.relative(process.cwd(), batchDirAbs);
  const batchResultsJsonPath = path.join(batchDirAbs, "batch_results.json");
  const batchResultsNdjsonPath = path.join(batchDirAbs, "batch_results.ndjson");
  const batchSummaryPath = path.join(batchDirAbs, "batch_summary.json");

  await ensureDir(batchDirAbs);

  const supabase = getSupabaseAdminClient();
  const dbRowsById = await loadLeadRowsFromDb({
    supabase,
    accountId,
    ids: selectedLeads.map((lead) => lead.id),
  });
  const browser = await connectToBrowser(args.debuggerUrl);

  const startedAt = new Date().toISOString();
  const results = [];

  try {
    console.log(`Loaded ${allLeads.length} leads from ${args.leadsPath}`);
    console.log(`Selected ${selectedLeads.length} leads after offset=${args.offset} limit=${args.limit || "all"}`);
    console.log(`Loaded ${dbRowsById.size} outreach rows for account ${accountId}`);
    console.log(`Connected to Chrome via ${args.debuggerUrl}`);
    console.log(`Batch directory: ${batchDir}`);

    for (let idx = 0; idx < selectedLeads.length; idx += 1) {
      const lead = selectedLeads[idx];
      const row = dbRowsById.get(lead.id) || null;
      const username =
        normalizeUsername(row?.prospect_username) ||
        normalizeUsername(row?.username) ||
        lead.username;
      const stepLabel = `[${idx + 1}/${selectedLeads.length}] ${username}`;

      const pipelineResult = await runResolvedLeadNetworkPipeline({
        browser,
        outputDir,
        runIndexPath,
        leadId: lead.id,
        username,
        row,
        runLabel: args.runLabel ? `${args.runLabel}-batch` : batchId,
        stepLabel,
        projectRoot: process.cwd(),
      });

      const resultRow = {
        lead_id: lead.id,
        username,
        ok: pipelineResult.ok,
        run_dir: pipelineResult.run_dir,
        thread_url: pipelineResult.capture_result?.thread_url || null,
        thread_id: pipelineResult.analysis_result?.thread_id || pipelineResult.capture_result?.thread_id || null,
        resolution_source: pipelineResult.capture_result?.resolution_source || null,
        matched_response_count: pipelineResult.capture_result?.matched_response_count || 0,
        classification_state: pipelineResult.classification_result?.classification_state || "failed_pipeline_run",
        recommended_action: pipelineResult.classification_result?.recommended_action || "human_review",
        confidence: pipelineResult.classification_result?.confidence || "low",
        error_reason: pipelineResult.error_reason || null,
        completed_at: new Date().toISOString(),
      };

      results.push(resultRow);
      await appendJsonLine(batchResultsNdjsonPath, resultRow);
      await saveJson(batchResultsJsonPath, results);
      await saveJson(
        batchSummaryPath,
        summarizeBatch(results, {
          batchId,
          batchDir,
          leadsPath: args.leadsPath,
          accountId,
          selectedLeadCount: selectedLeads.length,
          offset: args.offset,
          limit: args.limit,
          delayMs: args.delayMs,
          startedAt,
        })
      );

      if (idx < selectedLeads.length - 1 && args.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, args.delayMs));
      }
    }

    const summary = summarizeBatch(results, {
      batchId,
      batchDir,
      leadsPath: args.leadsPath,
      accountId,
      selectedLeadCount: selectedLeads.length,
      offset: args.offset,
      limit: args.limit,
      delayMs: args.delayMs,
      startedAt,
    });

    console.log("");
    console.log(`Completed batch thread pipeline: ${summary.success_count}/${summary.processed_lead_count} succeeded.`);
    console.log(`Failures: ${summary.failure_count}`);
    console.log(`Classification counts: ${JSON.stringify(summary.classification_counts)}`);
    console.log(`Batch results written to ${path.relative(process.cwd(), batchResultsJsonPath)}`);
    console.log(`Batch summary written to ${path.relative(process.cwd(), batchSummaryPath)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("");
  console.error("Instagram batch thread network pipeline failed before completion.");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
