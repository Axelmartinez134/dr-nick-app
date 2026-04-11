#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_OUTPUT_DIR = path.join(__dirname, "output");
const DEFAULT_INPUT_PATH = path.join(DEFAULT_OUTPUT_DIR, "network_capture_results.json");
const DEFAULT_RESULTS_PATH = path.join(DEFAULT_OUTPUT_DIR, "network_analysis_results.json");

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
  console.log(`Instagram DM network payload analyzer

Usage:
  node scripts/instagram_dm/analyze_thread_network_payload.mjs [--input path] [--output path] [--username handle]

Options:
  --input     network capture summary JSON (defaults to scripts/instagram_dm/output/network_capture_results.json)
  --output    analysis JSON output path (defaults to scripts/instagram_dm/output/network_analysis_results.json)
  --username  Optional. Analyze one specific captured username from the summary file
`);
  process.exit(code);
}

function normalizeUsername(value) {
  return String(value || "").trim().replace(/^@+/, "").toLowerCase();
}

function normalizeMs(value) {
  const raw = String(value ?? "").trim();
  return /^\d+$/.test(raw) ? raw : null;
}

function msToIso(value) {
  const raw = normalizeMs(value);
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  const date = new Date(num);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

function pickCaptureSummary(entries, username) {
  const rows = Array.isArray(entries) ? entries : [];
  if (!rows.length) {
    throw new Error("The capture summary file did not contain any rows.");
  }

  if (username) {
    const match = rows.find((row) => normalizeUsername(row?.username) === username);
    if (!match) {
      throw new Error(`No capture summary row matched --username ${username}`);
    }
    return match;
  }

  return rows[0];
}

function getCanonicalThread(payloadDoc) {
  return payloadDoc?.body?.data?.get_slide_thread_nullable?.as_ig_direct_thread || null;
}

function getLoadedMessages(thread) {
  const edges = Array.isArray(thread?.slide_messages?.edges) ? thread.slide_messages.edges : [];
  return edges
    .map((edge) => edge?.node || null)
    .filter(Boolean);
}

function scorePayloadDoc(payloadDoc) {
  const thread = getCanonicalThread(payloadDoc);
  if (!thread) return 0;

  let score = 100;
  if (Array.isArray(thread?.slide_messages?.edges) && thread.slide_messages.edges.length) score += 500;
  if (thread?.viewer_id) score += 100;
  if (Array.isArray(thread?.users) && thread.users.length) score += 50;
  if (thread?.thread_key) score += 25;
  if (thread?.thread_fbid) score += 25;
  if (thread?.thread_id) score += 25;
  if (Array.isArray(thread?.slide_read_receipts) && thread.slide_read_receipts.length) score += 10;
  return score;
}

async function loadPayloadDocs(filePaths) {
  const docs = [];
  for (const relPath of filePaths) {
    const absPath = path.resolve(process.cwd(), relPath);
    try {
      const doc = await readJson(absPath);
      docs.push({
        relativePath: relPath,
        absolutePath: absPath,
        payloadDoc: doc,
        score: scorePayloadDoc(doc),
      });
    } catch (error) {
      docs.push({
        relativePath: relPath,
        absolutePath: absPath,
        payloadDoc: null,
        score: -1,
        readError: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return docs;
}

function buildParticipantSummary(thread) {
  const participants = Array.isArray(thread?.users) ? thread.users : [];
  return participants.map((user) => ({
    id: String(user?.id || "").trim() || null,
    username: normalizeUsername(user?.username) || null,
    full_name: typeof user?.full_name === "string" ? user.full_name.trim() : null,
    interop_messaging_user_fbid: String(user?.interop_messaging_user_fbid || "").trim() || null,
  }));
}

function buildReadReceiptSummary(thread) {
  const receipts = Array.isArray(thread?.slide_read_receipts) ? thread.slide_read_receipts : [];
  return receipts.map((receipt) => {
    const watermark = normalizeMs(receipt?.watermark_timestamp_ms);
    return {
      participant_fbid: String(receipt?.participant_fbid || "").trim() || null,
      watermark_timestamp_ms: watermark,
      watermark_timestamp_iso: msToIso(watermark),
    };
  });
}

function buildMessageSummary(node, viewerInteropFbid) {
  if (!node) return null;

  const senderFbid = String(node?.sender_fbid || "").trim() || null;
  const repliedToSenderFbid = String(node?.replied_to_message?.sender_fbid || "").trim() || null;
  const ts = normalizeMs(node?.timestamp_ms);
  const textBody =
    typeof node?.text_body === "string" && node.text_body.trim()
      ? node.text_body.trim()
      : typeof node?.content?.text_body === "string" && node.content.text_body.trim()
        ? node.content.text_body.trim()
        : null;

  return {
    message_id: String(node?.message_id || node?.id || "").trim() || null,
    sender_fbid: senderFbid,
    sender_name: typeof node?.sender?.name === "string" ? node.sender.name.trim() : null,
    sender_username: normalizeUsername(node?.sender?.user_dict?.username) || null,
    is_from_viewer:
      !!viewerInteropFbid &&
      !!senderFbid &&
      senderFbid === viewerInteropFbid,
    content_type: typeof node?.content_type === "string" ? node.content_type.trim() : null,
    timestamp_ms: ts,
    timestamp_iso: msToIso(ts),
    text_preview: textBody ? textBody.slice(0, 280) : null,
    replied_to_message_id: String(node?.replied_to_message_id || "").trim() || null,
    replied_to_sender_fbid: repliedToSenderFbid,
    replied_to_sender_name:
      typeof node?.replied_to_message?.sender?.name === "string"
        ? node.replied_to_message.sender.name.trim()
        : null,
    replied_to_text_preview:
      typeof node?.replied_to_message?.text_body === "string" && node.replied_to_message.text_body.trim()
        ? node.replied_to_message.text_body.trim().slice(0, 280)
        : null,
    reaction_count: Array.isArray(node?.reactions) ? node.reactions.length : 0,
  };
}

function analyzeThreadFacts({ captureRow, bestDoc }) {
  const thread = getCanonicalThread(bestDoc.payloadDoc);
  if (!thread) {
    throw new Error("No canonical thread payload was found in the captured payloads.");
  }

  const viewerId = String(thread?.viewer_id || thread?.viewer?.id || "").trim() || null;
  const viewerInteropFbid =
    String(thread?.viewer?.interop_messaging_user_fbid || "").trim() || null;
  const participants = buildParticipantSummary(thread);
  const messages = getLoadedMessages(thread);
  const normalizedMessages = messages.map((node) =>
    buildMessageSummary(node, viewerInteropFbid)
  );
  const latestLoadedMessage = normalizedMessages[0] || null;
  const inboundMessages = normalizedMessages.filter((msg) => msg && msg.is_from_viewer === false);
  const outboundMessages = normalizedMessages.filter((msg) => msg && msg.is_from_viewer === true);

  return {
    lead_id: captureRow?.lead_id || null,
    username: normalizeUsername(captureRow?.username) || null,
    thread_url: captureRow?.thread_url || null,
    selected_payload_path: bestDoc.relativePath,
    selected_payload_score: bestDoc.score,
    selected_payload_shape: "data.get_slide_thread_nullable.as_ig_direct_thread",
    thread_key: String(thread?.thread_key || "").trim() || null,
    thread_fbid: String(thread?.thread_fbid || thread?.id || "").trim() || null,
    thread_id: String(thread?.thread_id || "").trim() || null,
    thread_title: typeof thread?.thread_title === "string" ? thread.thread_title.trim() : null,
    thread_subtype: typeof thread?.thread_subtype === "string" ? thread.thread_subtype.trim() : null,
    viewer_id: viewerId,
    viewer_igid: String(thread?.viewer?.id || "").trim() || null,
    viewer_interop_fbid: viewerInteropFbid,
    participant_ids: participants.map((user) => user.id).filter(Boolean),
    participant_usernames: participants.map((user) => user.username).filter(Boolean),
    participant_interop_fbids: participants
      .map((user) => user.interop_messaging_user_fbid)
      .filter(Boolean),
    participants,
    marked_as_unread:
      typeof thread?.marked_as_unread === "boolean" ? thread.marked_as_unread : null,
    last_activity_timestamp_ms: normalizeMs(thread?.last_activity_timestamp_ms),
    last_activity_timestamp_iso: msToIso(thread?.last_activity_timestamp_ms),
    read_receipts: buildReadReceiptSummary(thread),
    loaded_message_count: normalizedMessages.length,
    latest_loaded_message: latestLoadedMessage,
    has_inbound_messages_in_loaded_set: inboundMessages.length > 0,
    has_outbound_messages_in_loaded_set: outboundMessages.length > 0,
    tentative_signals: {
      latest_loaded_message_is_from_viewer:
        latestLoadedMessage ? latestLoadedMessage.is_from_viewer : null,
      loaded_inbound_message_count: inboundMessages.length,
      loaded_outbound_message_count: outboundMessages.length,
      latest_loaded_message_replies_to_other_participant:
        !!latestLoadedMessage &&
        !!latestLoadedMessage.replied_to_sender_fbid &&
        latestLoadedMessage.replied_to_sender_fbid !== viewerInteropFbid,
      read_receipt_count: Array.isArray(thread?.slide_read_receipts)
        ? thread.slide_read_receipts.length
        : 0,
    },
    analyzed_at: new Date().toISOString(),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const captureRows = await readJson(args.inputPath);
  const captureRow = pickCaptureSummary(captureRows, args.username);
  const payloadPaths = Array.isArray(captureRow?.saved_payload_paths)
    ? captureRow.saved_payload_paths
    : [];

  if (!payloadPaths.length) {
    throw new Error("The selected capture row did not contain any saved payload paths.");
  }

  const docs = await loadPayloadDocs(payloadPaths);
  const rankedDocs = docs
    .filter((doc) => doc.payloadDoc && doc.score >= 0)
    .sort((a, b) => b.score - a.score);

  if (!rankedDocs.length) {
    throw new Error("No readable payload documents were available for analysis.");
  }

  const bestDoc = rankedDocs[0];
  const analysis = analyzeThreadFacts({ captureRow, bestDoc });

  await fs.writeFile(args.outputPath, `${JSON.stringify([analysis], null, 2)}\n`, "utf-8");

  console.log(`Selected payload: ${analysis.selected_payload_path}`);
  console.log(`Selected shape: ${analysis.selected_payload_shape}`);
  console.log(`Username: ${analysis.username}`);
  console.log(`Thread key: ${analysis.thread_key || "(none)"}`);
  console.log(`Viewer interop fbid: ${analysis.viewer_interop_fbid || "(none)"}`);
  console.log(`Participants: ${analysis.participant_usernames.join(", ") || "(none)"}`);
  console.log(`Loaded messages: ${analysis.loaded_message_count}`);
  console.log(
    `Latest loaded message sender: ${analysis.latest_loaded_message?.sender_username || analysis.latest_loaded_message?.sender_name || "(none)"}`
  );
  console.log(
    `Latest loaded message type: ${analysis.latest_loaded_message?.content_type || "(none)"}`
  );
  console.log(
    `Latest loaded message from viewer: ${
      analysis.tentative_signals.latest_loaded_message_is_from_viewer === null
        ? "(unknown)"
        : analysis.tentative_signals.latest_loaded_message_is_from_viewer
          ? "yes"
          : "no"
    }`
  );
  console.log(
    `Inbound messages in loaded set: ${analysis.has_inbound_messages_in_loaded_set ? "yes" : "no"}`
  );
  console.log(
    `Outbound messages in loaded set: ${analysis.has_outbound_messages_in_loaded_set ? "yes" : "no"}`
  );
  console.log(`Read receipts found: ${analysis.read_receipts.length}`);
  console.log(`Marked as unread: ${analysis.marked_as_unread === null ? "(unknown)" : analysis.marked_as_unread ? "yes" : "no"}`);
  console.log(`Analysis written to ${path.relative(process.cwd(), args.outputPath)}`);
}

main().catch((error) => {
  console.error("");
  console.error("Instagram thread network analysis failed before completion.");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
