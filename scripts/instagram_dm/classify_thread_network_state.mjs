#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_OUTPUT_DIR = path.join(__dirname, "output");
const DEFAULT_INPUT_PATH = path.join(DEFAULT_OUTPUT_DIR, "network_analysis_results.json");
const DEFAULT_RESULTS_PATH = path.join(DEFAULT_OUTPUT_DIR, "network_classification_results.json");

function parseArgs(argv) {
  const args = {
    inputPath: DEFAULT_INPUT_PATH,
    outputPath: DEFAULT_RESULTS_PATH,
    username: "",
  };

  for (let idx = 0; idx < argv.length; idx += 1) {
    const token = argv[idx];
    const next = argv[idx + 1];

    if (token === "--input" && next) {
      args.inputPath = path.resolve(process.cwd(), next);
      idx += 1;
    } else if (token === "--output" && next) {
      args.outputPath = path.resolve(process.cwd(), next);
      idx += 1;
    } else if (token === "--username" && next) {
      args.username = normalizeUsername(next);
      idx += 1;
    } else if (token === "--help" || token === "-h") {
      printHelpAndExit(0);
    }
  }

  return args;
}

function printHelpAndExit(code) {
  console.log(`Instagram DM network thread classifier

Usage:
  node scripts/instagram_dm/classify_thread_network_state.mjs [--input path] [--output path] [--username handle]

Options:
  --input     analysis JSON input path (defaults to scripts/instagram_dm/output/network_analysis_results.json)
  --output    classification JSON output path (defaults to scripts/instagram_dm/output/network_classification_results.json)
  --username  Optional. Classify one specific analyzed username from the input file
`);
  process.exit(code);
}

function normalizeUsername(value) {
  return String(value || "").trim().replace(/^@+/, "").toLowerCase();
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

function pickAnalysisRows(entries, username) {
  const rows = Array.isArray(entries) ? entries : [];
  if (!rows.length) {
    throw new Error("The analysis input file did not contain any rows.");
  }

  if (!username) return rows;

  const filtered = rows.filter((row) => normalizeUsername(row?.username) === username);
  if (!filtered.length) {
    throw new Error(`No analysis row matched --username ${username}`);
  }

  return filtered;
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function buildBaseResult(row) {
  const participantInteropFbids = uniqueStrings(row?.participant_interop_fbids);
  const readReceipts = Array.isArray(row?.read_receipts) ? row.read_receipts : [];
  const receiptFbids = uniqueStrings(readReceipts.map((receipt) => receipt?.participant_fbid));
  const viewerInteropFbid = hasValue(row?.viewer_interop_fbid)
    ? String(row.viewer_interop_fbid).trim()
    : null;

  return {
    lead_id: row?.lead_id || null,
    username: normalizeUsername(row?.username) || null,
    thread_url: row?.thread_url || null,
    thread_id: row?.thread_id || null,
    classification_state: "review_ambiguous",
    recommended_action: "human_review",
    confidence: "low",
    latest_loaded_message_from_viewer:
      row?.latest_loaded_message?.is_from_viewer === true
        ? true
        : row?.latest_loaded_message?.is_from_viewer === false
          ? false
          : null,
    latest_loaded_message_type: row?.latest_loaded_message?.content_type || null,
    loaded_inbound_message_count:
      Number.isFinite(row?.tentative_signals?.loaded_inbound_message_count)
        ? row.tentative_signals.loaded_inbound_message_count
        : 0,
    loaded_outbound_message_count:
      Number.isFinite(row?.tentative_signals?.loaded_outbound_message_count)
        ? row.tentative_signals.loaded_outbound_message_count
        : 0,
    viewer_interop_fbid: viewerInteropFbid,
    participant_interop_fbids: participantInteropFbids,
    receipt_participant_fbids: receiptFbids,
    participant_receipt_fbids: receiptFbids.filter((fbid) => fbid !== viewerInteropFbid),
    participant_receipt_count: receiptFbids.filter((fbid) => fbid !== viewerInteropFbid).length,
    matched_participant_receipt_found: receiptFbids.some(
      (fbid) => participantInteropFbids.includes(fbid) && fbid !== viewerInteropFbid
    ),
    reason_codes: [],
    source_analysis_path: row?.selected_payload_path || null,
    classified_at: new Date().toISOString(),
  };
}

function classifyRow(row) {
  const result = buildBaseResult(row);
  const participantInteropFbids = result.participant_interop_fbids;
  const viewerInteropFbid = result.viewer_interop_fbid;
  const hasInbound = result.loaded_inbound_message_count > 0;
  const latestFromViewer = result.latest_loaded_message_from_viewer;
  const hasParticipantReceipt = result.matched_participant_receipt_found;
  const hasViewerReceipt =
    !!viewerInteropFbid && result.receipt_participant_fbids.includes(viewerInteropFbid);

  if (!hasValue(row?.selected_payload_path)) {
    result.reason_codes.push("missing_selected_payload_path");
  }
  if (!hasValue(row?.thread_id)) {
    result.reason_codes.push("missing_thread_id");
  }
  if (!viewerInteropFbid) {
    result.reason_codes.push("missing_viewer_interop_fbid");
  }
  if (!participantInteropFbids.length) {
    result.reason_codes.push("missing_participant_interop_fbids");
  }
  if (!row?.latest_loaded_message) {
    result.reason_codes.push("missing_latest_loaded_message");
  }
  if (
    !Array.isArray(row?.read_receipts) ||
    row.read_receipts.length === 0
  ) {
    result.reason_codes.push("missing_read_receipts");
  }

  if (result.reason_codes.length > 0) {
    return result;
  }

  if (hasInbound) {
    result.classification_state = "review_replied_or_ongoing";
    result.recommended_action = "human_review";
    result.confidence = "high";
    result.reason_codes.push("inbound_messages_detected");
    return result;
  }

  if (latestFromViewer !== true) {
    result.classification_state = "review_ambiguous";
    result.recommended_action = "human_review";
    result.confidence = "low";
    result.reason_codes.push("latest_loaded_message_not_from_viewer");
    return result;
  }

  if (hasParticipantReceipt) {
    result.classification_state = "safe_seen_no_reply";
    result.recommended_action = "hold_waiting";
    result.confidence = "high";
    result.reason_codes.push("participant_read_receipt_present");
    return result;
  }

  if (hasViewerReceipt && !hasParticipantReceipt) {
    result.classification_state = "safe_unseen_no_reply";
    result.recommended_action = "candidate_followup";
    result.confidence = "high";
    result.reason_codes.push("viewer_receipt_only");
    return result;
  }

  result.classification_state = "review_ambiguous";
  result.recommended_action = "human_review";
  result.confidence = "low";
  result.reason_codes.push("receipt_pattern_unresolved");
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputRows = await readJson(args.inputPath);
  const analysisRows = pickAnalysisRows(inputRows, args.username);
  const results = analysisRows.map((row) => classifyRow(row));

  await fs.writeFile(args.outputPath, `${JSON.stringify(results, null, 2)}\n`, "utf-8");

  for (const result of results) {
    console.log(`Username: ${result.username || "(unknown)"}`);
    console.log(`Thread id: ${result.thread_id || "(none)"}`);
    console.log(
      `Latest loaded message from viewer: ${
        result.latest_loaded_message_from_viewer === null
          ? "(unknown)"
          : result.latest_loaded_message_from_viewer
            ? "yes"
            : "no"
      }`
    );
    console.log(`Inbound messages: ${result.loaded_inbound_message_count}`);
    console.log(`Outbound messages: ${result.loaded_outbound_message_count}`);
    console.log(
      `Participant receipts: ${
        result.participant_receipt_fbids.length
          ? result.participant_receipt_fbids.join(", ")
          : "(none)"
      }`
    );
    console.log(`Classification: ${result.classification_state}`);
    console.log(`Recommended action: ${result.recommended_action}`);
    console.log(`Confidence: ${result.confidence}`);
    console.log(`Reason codes: ${result.reason_codes.join(", ") || "(none)"}`);
    console.log("");
  }

  console.log(`Classification written to ${path.relative(process.cwd(), args.outputPath)}`);
}

main().catch((error) => {
  console.error("");
  console.error("Instagram thread network classification failed before completion.");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
