#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  connectToBrowser,
  ensureDir,
  runResolvedLeadNetworkCheckWithPage,
  sendMessageInOpenThread,
  slugify,
} from "./thread_network_pipeline_lib.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_DIR = path.join(__dirname, "output");
const ELIGIBLE_STATES = new Set(["safe_unseen_no_reply", "safe_seen_no_reply"]);
const FOLLOWUP_MESSAGES = {
  1: "Did the carousel format feel right for your audience, or would a different visual style work better?",
  2: "Wanted to make sure you saw this. That carousel is yours to use either way just let me know if I can send it over.",
  3: "All good if this isn't a priority right now ill move out of your inbox. If you ever want to test carousels, the offer's open :)",
};

function parseArgs(argv) {
  const args = {
    accountId: process.env.EDITOR_ACCOUNT_ID || "",
    debuggerUrl: process.env.IG_DEBUGGER_URL || "http://127.0.0.1:9222",
    limit: 25,
    offset: 0,
    minDaysSinceLastContact: 4,
    maxSends: 10,
    stopAfterFailures: 3,
    duplicateGuardHours: 72,
    delayMsMin: 2000,
    delayMsMax: 5000,
    preSendDelayMsMin: 1000,
    preSendDelayMsMax: 2500,
    postSendDelayMsMin: 1000,
    postSendDelayMsMax: 2000,
    sendLive: false,
    usernames: [],
    runLabel: "",
  };

  for (let idx = 0; idx < argv.length; idx += 1) {
    const token = argv[idx];
    const next = argv[idx + 1];
    if (token === "--account-id" && next) {
      args.accountId = String(next || "").trim();
      idx += 1;
    } else if (token === "--debugger-url" && next) {
      args.debuggerUrl = String(next || "").trim();
      idx += 1;
    } else if (token === "--limit" && next) {
      args.limit = Number(next);
      idx += 1;
    } else if (token === "--offset" && next) {
      args.offset = Number(next);
      idx += 1;
    } else if (token === "--min-days" && next) {
      args.minDaysSinceLastContact = Number(next);
      idx += 1;
    } else if (token === "--max-sends" && next) {
      args.maxSends = Number(next);
      idx += 1;
    } else if (token === "--stop-after-failures" && next) {
      args.stopAfterFailures = Number(next);
      idx += 1;
    } else if (token === "--duplicate-guard-hours" && next) {
      args.duplicateGuardHours = Number(next);
      idx += 1;
    } else if (token === "--delay-ms-min" && next) {
      args.delayMsMin = Number(next);
      idx += 1;
    } else if (token === "--delay-ms-max" && next) {
      args.delayMsMax = Number(next);
      idx += 1;
    } else if (token === "--pre-send-delay-ms-min" && next) {
      args.preSendDelayMsMin = Number(next);
      idx += 1;
    } else if (token === "--pre-send-delay-ms-max" && next) {
      args.preSendDelayMsMax = Number(next);
      idx += 1;
    } else if (token === "--post-send-delay-ms-min" && next) {
      args.postSendDelayMsMin = Number(next);
      idx += 1;
    } else if (token === "--post-send-delay-ms-max" && next) {
      args.postSendDelayMsMax = Number(next);
      idx += 1;
    } else if (token === "--username" && next) {
      args.usernames.push(String(next || "").trim());
      idx += 1;
    } else if (token === "--run-label" && next) {
      args.runLabel = String(next || "").trim();
      idx += 1;
    } else if (token === "--send-live") {
      args.sendLive = true;
    } else if (token === "--dry-run") {
      args.sendLive = false;
    } else if (token === "--help" || token === "-h") {
      printHelpAndExit(0);
    }
  }

  return args;
}

function printHelpAndExit(code) {
  console.log(`Execute safe Instagram follow-ups from Supabase

Usage:
  node scripts/instagram_dm/execute_safe_followups.mjs --account-id <uuid> [options]

Options:
  --account-id   Required. Outreach account UUID to read/update
  --debugger-url Chrome remote debugging URL (default: http://127.0.0.1:9222)
  --limit        Max eligible leads to process after filtering (default: 25)
  --offset       Skip this many eligible leads before processing
  --min-days     Minimum full days since last_contact_date (default: 4)
  --max-sends    Max successful sends in one live run (default: 10)
  --stop-after-failures Abort after this many consecutive failures (default: 3)
  --duplicate-guard-hours Skip if same follow-up was already sent recently (default: 72)
  --delay-ms-min Inter-lead delay minimum in ms (default: 2000)
  --delay-ms-max Inter-lead delay maximum in ms (default: 5000)
  --pre-send-delay-ms-min Delay after typing before send, min ms (default: 1000)
  --pre-send-delay-ms-max Delay after typing before send, max ms (default: 2500)
  --post-send-delay-ms-min Delay after send before close, min ms (default: 1000)
  --post-send-delay-ms-max Delay after send before close, max ms (default: 2000)
  --username     Optional exact username filter; can be repeated
  --run-label    Optional label appended to the execution batch id
  --dry-run      Default. Perform live recheck but do not send or write DB changes
  --send-live    Actually send messages and write execution state + audit events
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
  for (const name of [".env.local", ".env"]) {
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
      // Ignore missing files.
    }
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

function normalizeUsername(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const normalized = raw.replace(/^@+/, "").trim().toLowerCase();
  return normalized || null;
}

function s(value) {
  const out = typeof value === "string" ? value.trim() : "";
  return out || null;
}

function todayYmdUtc() {
  const d = new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseYmdUtcMs(value) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return NaN;
  return Date.parse(`${raw}T00:00:00.000Z`);
}

function diffFullDaysFromToday(value) {
  const ts = parseYmdUtcMs(value);
  if (!Number.isFinite(ts)) return NaN;
  const todayTs = parseYmdUtcMs(todayYmdUtc());
  return Math.floor((todayTs - ts) / 86400000);
}

function diffFullDaysFromIsoToday(value) {
  const raw = String(value || "").trim();
  if (!raw) return NaN;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return NaN;
  const todayTs = parseYmdUtcMs(todayYmdUtc());
  return Math.floor((todayTs - ts) / 86400000);
}

function getNextFollowupNumber(row) {
  const raw = row?.followup_sent_count;
  if (raw === null || raw === undefined) return 1;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.floor(n) + 1;
}

function getFollowupMessage(nextFollowupNumber) {
  return FOLLOWUP_MESSAGES[nextFollowupNumber] || null;
}

function clampInt(value, fallback, min = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.floor(n));
}

function normalizeDelayRange(minValue, maxValue, fallbackMin, fallbackMax) {
  const minMs = clampInt(minValue, fallbackMin, 0);
  const maxMs = clampInt(maxValue, fallbackMax, 0);
  return {
    min: Math.min(minMs, maxMs),
    max: Math.max(minMs, maxMs),
  };
}

function randomIntBetween(minValue, maxValue) {
  const min = Math.floor(Math.min(minValue, maxValue));
  const max = Math.floor(Math.max(minValue, maxValue));
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

async function sleep(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function getEligibilityAnchor(row, nextFollowupNumber) {
  const lastContactDate = s(row?.last_contact_date);
  if (lastContactDate) {
    return {
      anchor_type: "last_contact_date",
      anchor_value: lastContactDate,
      days_since_contact: diffFullDaysFromToday(lastContactDate),
    };
  }

  if (nextFollowupNumber === 1) {
    const createdAt = s(row?.created_at);
    if (createdAt) {
      return {
        anchor_type: "created_at",
        anchor_value: createdAt,
        days_since_contact: diffFullDaysFromIsoToday(createdAt),
      };
    }
  }

  return {
    anchor_type: null,
    anchor_value: null,
    days_since_contact: NaN,
  };
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

async function loadEligibleCandidates({ supabase, accountId, usernameFilter }) {
  const { data, error } = await supabase
    .from("editor_outreach_targets")
    .select(
      [
        "id",
        "account_id",
        "created_at",
        "created_by_user_id",
        "prospect_username",
        "username",
        "prospect_full_name",
        "full_name",
        "pipeline_stage",
        "last_contact_date",
        "followup_sent_count",
        "instagram_dm_thread_url",
        "instagram_dm_thread_id",
        "instagram_dm_thread_last_state",
        "instagram_dm_thread_last_recommended_action",
        "instagram_dm_thread_last_classified_at",
        "instagram_dm_thread_last_run_artifact_path",
        "instagram_dm_last_execution_state",
        "instagram_dm_last_execution_at",
        "instagram_dm_last_execution_error",
        "instagram_dm_last_followup_number",
        "instagram_dm_last_followup_message",
        "instagram_dm_last_execution_run_artifact_path",
      ].join(",")
    )
    .eq("account_id", accountId)
    .eq("pipeline_stage", "dm_sent")
    .not("instagram_dm_thread_url", "is", null)
    .in("instagram_dm_thread_last_state", Array.from(ELIGIBLE_STATES))
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    throw new Error(error.message);
  }

  const rows = Array.isArray(data) ? data : [];
  const dedupedByUsername = new Map();
  for (const row of rows) {
    const username = normalizeUsername(row?.prospect_username) || normalizeUsername(row?.username);
    if (!username) continue;
    if (usernameFilter.size && !usernameFilter.has(username)) continue;
    if (!dedupedByUsername.has(username)) {
      dedupedByUsername.set(username, row);
    }
  }

  return Array.from(dedupedByUsername.values());
}

async function loadRecentSuccessfulSendGuards({
  supabase,
  accountId,
  leadIds,
  duplicateGuardHours,
}) {
  const guardMap = new Map();
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return guardMap;
  }

  const hours = clampInt(duplicateGuardHours, 72, 1);
  const cutoffIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("editor_outreach_dm_execution_events")
    .select("outreach_target_id, followup_number, created_at, event_type")
    .eq("account_id", accountId)
    .eq("event_type", "sent_followup")
    .gte("created_at", cutoffIso)
    .in("outreach_target_id", leadIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of Array.isArray(data) ? data : []) {
    const leadId = String(row?.outreach_target_id || "").trim();
    const followupNumber = Number(row?.followup_number);
    const createdAt = String(row?.created_at || "").trim();
    if (!leadId || !Number.isFinite(followupNumber) || !createdAt) continue;
    const key = `${leadId}:${Math.floor(followupNumber)}`;
    const existing = guardMap.get(key);
    if (!existing || Date.parse(createdAt) > Date.parse(existing)) {
      guardMap.set(key, createdAt);
    }
  }

  return guardMap;
}

function evaluateEligibility(
  row,
  minDaysSinceLastContact,
  recentSuccessfulFollowups = new Map()
) {
  const leadId = String(row?.id || "").trim();
  const username = normalizeUsername(row?.prospect_username) || normalizeUsername(row?.username) || "";
  const state = s(row?.instagram_dm_thread_last_state);
  const threadUrl = s(row?.instagram_dm_thread_url);
  const nextFollowupNumber = getNextFollowupNumber(row);
  const followupMessage = getFollowupMessage(nextFollowupNumber);
  const anchor = getEligibilityAnchor(row, nextFollowupNumber);
  const daysSinceLastContact = anchor.days_since_contact;
  const recentSuccessAt = leadId
    ? recentSuccessfulFollowups.get(`${leadId}:${nextFollowupNumber}`) || null
    : null;

  if (!username) {
    return { eligible: false, reason: "missing_username" };
  }
  if (!threadUrl) {
    return { eligible: false, reason: "missing_thread_url" };
  }
  if (!ELIGIBLE_STATES.has(String(state || ""))) {
    return { eligible: false, reason: "classification_not_safe" };
  }
  if (nextFollowupNumber > 3) {
    return { eligible: false, reason: "followup_cap_reached" };
  }
  if (!followupMessage) {
    return { eligible: false, reason: "missing_followup_template" };
  }
  if (recentSuccessAt) {
    return {
      eligible: false,
      reason: "duplicate_send_guard_recent_success",
      recent_success_at: recentSuccessAt,
    };
  }
  if (!anchor.anchor_value) {
    return { eligible: false, reason: "missing_contact_anchor" };
  }
  if (!Number.isFinite(daysSinceLastContact)) {
    return {
      eligible: false,
      reason: "invalid_contact_anchor",
      anchor_type: anchor.anchor_type,
      anchor_value: anchor.anchor_value,
    };
  }
  if (daysSinceLastContact < minDaysSinceLastContact) {
    return {
      eligible: false,
      reason: "wait_window_not_met",
      days_since_last_contact: daysSinceLastContact,
      anchor_type: anchor.anchor_type,
      anchor_value: anchor.anchor_value,
    };
  }

  return {
    eligible: true,
    username,
    thread_url: threadUrl,
    next_followup_number: nextFollowupNumber,
    followup_message: followupMessage,
    days_since_last_contact: daysSinceLastContact,
    contact_anchor_type: anchor.anchor_type,
    contact_anchor_value: anchor.anchor_value,
  };
}

async function insertExecutionEvent(supabase, event) {
  const { error } = await supabase.from("editor_outreach_dm_execution_events").insert(event);
  if (error) throw new Error(error.message);
}

async function updateExecutionFields(supabase, { accountId, leadId, patch }) {
  const { data, error } = await supabase
    .from("editor_outreach_targets")
    .update(patch)
    .eq("account_id", accountId)
    .eq("id", leadId)
    .select("id");

  if (error) throw new Error(error.message);
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("No matching outreach row updated for supplied account_id.");
  }
}

async function persistExecutionResult({
  supabase,
  accountId,
  leadId,
  username,
  threadUrl,
  runDir,
  executionState,
  followupNumber,
  messageText,
  classificationState,
  recommendedAction,
  errorMessage,
  sendSucceeded,
}) {
  const nowIso = new Date().toISOString();
  const patch = {
    instagram_dm_last_execution_state: executionState,
    instagram_dm_last_execution_at: nowIso,
    instagram_dm_last_execution_error: errorMessage || null,
    instagram_dm_last_execution_run_artifact_path: runDir,
  };

  if (sendSucceeded) {
    patch.instagram_dm_last_followup_number = followupNumber;
    patch.instagram_dm_last_followup_message = messageText;
    patch.followup_sent_count = followupNumber;
    patch.last_contact_date = todayYmdUtc();
  }

  await updateExecutionFields(supabase, {
    accountId,
    leadId,
    patch,
  });

  await insertExecutionEvent(supabase, {
    account_id: accountId,
    outreach_target_id: leadId,
    username,
    thread_url: threadUrl,
    event_type: executionState,
    followup_number: sendSucceeded ? followupNumber : null,
    message_text: sendSucceeded ? messageText : null,
    classification_state: classificationState,
    recommended_action: recommendedAction,
    artifact_path: runDir,
    error_message: errorMessage || null,
  });
}

async function main() {
  await loadLocalEnvFiles();
  const args = parseArgs(process.argv.slice(2));

  const accountId = String(args.accountId || "").trim();
  if (!accountId) {
    throw new Error("Missing account id. Pass --account-id <uuid> or set EDITOR_ACCOUNT_ID.");
  }

  const limit = Number.isFinite(args.limit) ? Math.max(1, Math.floor(args.limit)) : 25;
  const offset = Number.isFinite(args.offset) ? Math.max(0, Math.floor(args.offset)) : 0;
  const minDaysSinceLastContact = Number.isFinite(args.minDaysSinceLastContact)
    ? Math.max(1, Math.floor(args.minDaysSinceLastContact))
    : 4;
  const maxSends = clampInt(args.maxSends, 10, 1);
  const stopAfterFailures = clampInt(args.stopAfterFailures, 3, 1);
  const duplicateGuardHours = clampInt(args.duplicateGuardHours, 72, 1);
  const interLeadDelay = normalizeDelayRange(args.delayMsMin, args.delayMsMax, 2000, 5000);
  const preSendDelay = normalizeDelayRange(
    args.preSendDelayMsMin,
    args.preSendDelayMsMax,
    1000,
    2500
  );
  const postSendDelay = normalizeDelayRange(
    args.postSendDelayMsMin,
    args.postSendDelayMsMax,
    1000,
    2000
  );

  const usernameFilter = new Set(
    (Array.isArray(args.usernames) ? args.usernames : [])
      .map((value) => normalizeUsername(value))
      .filter(Boolean)
  );

  const batchTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const batchIdBase = `followup-execution-${batchTimestamp}`;
  const batchId = args.runLabel ? `${batchIdBase}-${slugify(args.runLabel)}` : batchIdBase;
  const batchDir = path.join(OUTPUT_DIR, "followup_execution_batches", batchId);
  await ensureDir(batchDir);

  const supabase = getSupabaseAdminClient();
  const candidates = await loadEligibleCandidates({ supabase, accountId, usernameFilter });
  const recentSuccessfulFollowups = await loadRecentSuccessfulSendGuards({
    supabase,
    accountId,
    leadIds: candidates.map((row) => String(row?.id || "").trim()).filter(Boolean),
    duplicateGuardHours,
  });
  const evaluatedCandidates = candidates.map((row) => ({
    row,
    eligibility: evaluateEligibility(row, minDaysSinceLastContact, recentSuccessfulFollowups),
  }));
  const exclusionReasonCounts = {};
  const eligibilityResults = [];

  for (const entry of evaluatedCandidates) {
    if (entry.eligibility.eligible) {
      eligibilityResults.push(entry);
      continue;
    }
    const reason = String(entry?.eligibility?.reason || "unknown_exclusion_reason");
    exclusionReasonCounts[reason] = (exclusionReasonCounts[reason] || 0) + 1;
  }

  eligibilityResults.sort((a, b) => {
    const aTs =
      a.eligibility.contact_anchor_type === "created_at"
        ? Date.parse(String(a.eligibility.contact_anchor_value || "")) || 0
        : parseYmdUtcMs(a.eligibility.contact_anchor_value || "");
    const bTs =
      b.eligibility.contact_anchor_type === "created_at"
        ? Date.parse(String(b.eligibility.contact_anchor_value || "")) || 0
        : parseYmdUtcMs(b.eligibility.contact_anchor_value || "");
    if (aTs !== bTs) return aTs - bTs;
    return String(a.eligibility.username || "").localeCompare(String(b.eligibility.username || ""));
  });

  const selected = eligibilityResults.slice(offset, offset + limit);

  console.log(
    `Loaded ${candidates.length} candidate rows for account ${accountId}; processing ${selected.length} eligible lead(s) (${args.sendLive ? "send-live" : "dry-run"}).`
  );
  console.log(
    `Safety rails: max_sends=${maxSends} stop_after_failures=${stopAfterFailures} duplicate_guard_hours=${duplicateGuardHours} delay_ms=${interLeadDelay.min}-${interLeadDelay.max} pre_send_ms=${preSendDelay.min}-${preSendDelay.max} post_send_ms=${postSendDelay.min}-${postSendDelay.max}`
  );
  if (Object.keys(exclusionReasonCounts).length > 0) {
    console.log(`Excluded by reason: ${JSON.stringify(exclusionReasonCounts)}`);
  }

  const batchSummary = {
    account_id: accountId,
    batch_id: batchId,
    created_at: new Date().toISOString(),
    dry_run: !args.sendLive,
    limit,
    offset,
    min_days_since_last_contact: minDaysSinceLastContact,
    total_candidates: candidates.length,
    total_eligible: eligibilityResults.length,
    total_selected: selected.length,
    max_sends: maxSends,
    stop_after_failures: stopAfterFailures,
    duplicate_guard_hours: duplicateGuardHours,
    delay_ms_range: interLeadDelay,
    pre_send_delay_ms_range: preSendDelay,
    post_send_delay_ms_range: postSendDelay,
    exclusion_reason_counts: exclusionReasonCounts,
    excluded_rows: evaluatedCandidates
      .filter((entry) => !entry.eligibility.eligible)
      .map((entry) => ({
        lead_id: String(entry?.row?.id || "").trim() || null,
        username:
          normalizeUsername(entry?.row?.prospect_username) ||
          normalizeUsername(entry?.row?.username) ||
          null,
        reason: String(entry?.eligibility?.reason || "unknown_exclusion_reason"),
        days_since_last_contact:
          typeof entry?.eligibility?.days_since_last_contact === "number" &&
          Number.isFinite(entry.eligibility.days_since_last_contact)
            ? entry.eligibility.days_since_last_contact
            : null,
        contact_anchor_type:
          typeof entry?.eligibility?.anchor_type === "string"
            ? entry.eligibility.anchor_type
            : null,
        contact_anchor_value:
          typeof entry?.eligibility?.anchor_value === "string"
            ? entry.eligibility.anchor_value
            : null,
        recent_success_at:
          typeof entry?.eligibility?.recent_success_at === "string"
            ? entry.eligibility.recent_success_at
            : null,
      })),
    aborted_reason: null,
    not_attempted_rows: [],
    results: [],
  };

  if (!selected.length) {
    await writeJson(path.join(batchDir, "summary.json"), batchSummary);
    console.log(`No eligible leads matched the sender filters. Summary: ${path.relative(REPO_ROOT, batchDir)}`);
    return;
  }

  const browser = await connectToBrowser(args.debuggerUrl);
  console.log(`Connected to Chrome via ${args.debuggerUrl}`);

  let successfulSendCount = 0;
  let consecutiveFailureCount = 0;
  try {
    for (let idx = 0; idx < selected.length; idx += 1) {
      if (args.sendLive && successfulSendCount >= maxSends) {
        batchSummary.aborted_reason = "max_sends_reached";
        batchSummary.not_attempted_rows = selected.slice(idx).map(({ row, eligibility }) => ({
          lead_id: String(row?.id || "").trim() || null,
          username: eligibility.username || null,
          reason: "max_sends_reached",
        }));
        console.log(`Stopping batch before item ${idx + 1}: max sends reached (${maxSends}).`);
        break;
      }
      if (consecutiveFailureCount >= stopAfterFailures) {
        batchSummary.aborted_reason = "failure_threshold_reached";
        batchSummary.not_attempted_rows = selected.slice(idx).map(({ row, eligibility }) => ({
          lead_id: String(row?.id || "").trim() || null,
          username: eligibility.username || null,
          reason: "failure_threshold_reached",
        }));
        console.log(
          `Stopping batch before item ${idx + 1}: consecutive failures reached (${stopAfterFailures}).`
        );
        break;
      }

      const { row, eligibility } = selected[idx];
      const leadId = String(row?.id || "").trim();
      const username = eligibility.username;
      const threadUrl = eligibility.thread_url;
      const nextFollowupNumber = eligibility.next_followup_number;
      const followupMessage = eligibility.followup_message;
      const label = `[${idx + 1}/${selected.length}] ${username}`;
      let retainedPage = null;
      let sendWasCompleted = false;

      let executionRecord = {
        ok: false,
        lead_id: leadId,
        username,
        thread_url: threadUrl,
        run_dir: null,
        followup_number: nextFollowupNumber,
        dry_run: !args.sendLive,
        selected_state: s(row?.instagram_dm_thread_last_state),
        selected_recommended_action: s(row?.instagram_dm_thread_last_recommended_action),
        selected_last_contact_date: s(row?.last_contact_date),
        days_since_last_contact: eligibility.days_since_last_contact,
        execution_state: null,
        live_classification_state: null,
        live_recommended_action: null,
        send_verification_method: null,
        error_reason: null,
      };

      try {
        const networkCheck = await runResolvedLeadNetworkCheckWithPage({
          browser,
          outputDir: OUTPUT_DIR,
          runLabel: batchId,
          stepLabel: label,
          leadId,
          username,
          row,
          threadUrlOverride: threadUrl,
          projectRoot: REPO_ROOT,
        });

        executionRecord.run_dir = networkCheck?.run_dir || null;
        executionRecord.live_classification_state = s(
          networkCheck?.classification_result?.classification_state
        );
        executionRecord.live_recommended_action = s(
          networkCheck?.classification_result?.recommended_action
        );

        if (!networkCheck?.ok || !networkCheck?.page) {
          throw new Error(networkCheck?.error_reason || "Live recheck failed.");
        }

        const page = networkCheck.page;
        retainedPage = page;
        const classificationState = String(
          networkCheck?.classification_result?.classification_state || ""
        ).trim();
        const recommendedAction = String(
          networkCheck?.classification_result?.recommended_action || ""
        ).trim();

        if (!ELIGIBLE_STATES.has(classificationState)) {
          executionRecord.execution_state = "blocked_live_recheck";
          executionRecord.error_reason = `Live recheck returned ${classificationState || "unknown_state"}.`;
          console.log(
            `${label} -> BLOCKED -> live_state=${classificationState || "unknown"} action=${recommendedAction || "unknown"}`
          );

          if (args.sendLive) {
            await persistExecutionResult({
              supabase,
              accountId,
              leadId,
              username,
              threadUrl,
              runDir: executionRecord.run_dir,
              executionState: executionRecord.execution_state,
              followupNumber: nextFollowupNumber,
              messageText: followupMessage,
              classificationState,
              recommendedAction,
              errorMessage: executionRecord.error_reason,
              sendSucceeded: false,
            });
          }

          await page.close().catch(() => {});
          executionRecord.ok = true;
        } else if (!args.sendLive) {
          executionRecord.execution_state = "dry_run_ready";
          console.log(
            `${label} -> DRY RUN READY -> followup=${nextFollowupNumber} live_state=${classificationState}`
          );
          await page.close().catch(() => {});
          executionRecord.ok = true;
        } else {
          const preSendDelayMs = randomIntBetween(preSendDelay.min, preSendDelay.max);
          const postSendDelayMs = randomIntBetween(postSendDelay.min, postSendDelay.max);
          console.log(
            `${label} -> typing pause ${preSendDelayMs}ms, post-send pause ${postSendDelayMs}ms`
          );
          const sendResult = await sendMessageInOpenThread({
            page,
            messageText: followupMessage,
            preSendDelayMs,
            postSendDelayMs,
          });
          sendWasCompleted = true;

          executionRecord.execution_state = "sent_followup";
          executionRecord.send_verification_method = s(sendResult?.verification_method);
          console.log(
            `${label} -> SENT -> followup=${nextFollowupNumber} verify=${executionRecord.send_verification_method || "unknown"}`
          );

          await persistExecutionResult({
            supabase,
            accountId,
            leadId,
            username,
            threadUrl,
            runDir: executionRecord.run_dir,
            executionState: executionRecord.execution_state,
            followupNumber: nextFollowupNumber,
            messageText: followupMessage,
            classificationState,
            recommendedAction,
            errorMessage: null,
            sendSucceeded: true,
          });

          await page.close().catch(() => {});
          retainedPage = null;
          executionRecord.ok = true;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        executionRecord.error_reason = message;

        if (args.sendLive && sendWasCompleted) {
          executionRecord.execution_state = "sent_followup";
          console.log(`${label} -> SENT WITH PERSIST RETRY -> ${message}`);
          await persistExecutionResult({
            supabase,
            accountId,
            leadId,
            username,
            threadUrl,
            runDir: executionRecord.run_dir,
            executionState: "sent_followup",
            followupNumber: nextFollowupNumber,
            messageText: followupMessage,
            classificationState: executionRecord.live_classification_state,
            recommendedAction: executionRecord.live_recommended_action,
            errorMessage: null,
            sendSucceeded: true,
          }).catch((persistError) => {
            const persistMessage =
              persistError instanceof Error ? persistError.message : String(persistError);
            executionRecord.execution_state = "sent_followup_persist_failed";
            executionRecord.error_reason = `${message} | persist_retry_failed=${persistMessage}`;
          });
        } else if (args.sendLive) {
          executionRecord.execution_state = "send_failed";
          console.log(`${label} -> FAIL -> ${message}`);
          await persistExecutionResult({
            supabase,
            accountId,
            leadId,
            username,
            threadUrl,
            runDir: executionRecord.run_dir,
            executionState: executionRecord.execution_state,
            followupNumber: nextFollowupNumber,
            messageText: followupMessage,
            classificationState: executionRecord.live_classification_state,
            recommendedAction: executionRecord.live_recommended_action,
            errorMessage: message,
            sendSucceeded: false,
          }).catch(async (persistError) => {
            const persistMessage =
              persistError instanceof Error ? persistError.message : String(persistError);
            executionRecord.error_reason = `${message} | persist_error=${persistMessage}`;
          });
        } else {
          executionRecord.execution_state = "dry_run_failed";
          console.log(`${label} -> FAIL -> ${message}`);
        }
      } finally {
        if (retainedPage) {
          await retainedPage.close().catch(() => {});
        }
      }

      if (
        executionRecord.execution_state === "sent_followup" ||
        executionRecord.execution_state === "sent_followup_persist_failed"
      ) {
        successfulSendCount += 1;
        consecutiveFailureCount = 0;
      } else if (
        executionRecord.execution_state === "send_failed" ||
        executionRecord.execution_state === "dry_run_failed"
      ) {
        consecutiveFailureCount += 1;
      } else {
        consecutiveFailureCount = 0;
      }

      if (executionRecord.run_dir) {
        const runDirAbs = path.resolve(REPO_ROOT, executionRecord.run_dir);
        await writeJson(path.join(runDirAbs, "execution_result.json"), executionRecord).catch(
          () => {}
        );
      }

      batchSummary.results.push(executionRecord);
      await writeJson(path.join(batchDir, "summary.json"), batchSummary);

      if (idx < selected.length - 1) {
        const delayMs = randomIntBetween(interLeadDelay.min, interLeadDelay.max);
        console.log(`${label} -> cooling down ${delayMs}ms before next lead`);
        await sleep(delayMs);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const sentCount = batchSummary.results.filter((row) => row.execution_state === "sent_followup")
    .length;
  const sentPersistFailedCount = batchSummary.results.filter(
    (row) => row.execution_state === "sent_followup_persist_failed"
  ).length;
  const readyCount = batchSummary.results.filter((row) => row.execution_state === "dry_run_ready")
    .length;
  const blockedCount = batchSummary.results.filter(
    (row) => row.execution_state === "blocked_live_recheck"
  ).length;
  const failedCount = batchSummary.results.filter(
    (row) =>
      row.execution_state === "send_failed" || row.execution_state === "dry_run_failed"
  ).length;
  const sentUsernames = batchSummary.results
    .filter((row) => row.execution_state === "sent_followup")
    .map((row) => row.username);
  const sentPersistFailedUsernames = batchSummary.results
    .filter((row) => row.execution_state === "sent_followup_persist_failed")
    .map((row) => row.username);
  const blockedUsernames = batchSummary.results
    .filter((row) => row.execution_state === "blocked_live_recheck")
    .map((row) => row.username);
  const failedUsernames = batchSummary.results
    .filter(
      (row) => row.execution_state === "send_failed" || row.execution_state === "dry_run_failed"
    )
    .map((row) => row.username);
  const dryRunReadyUsernames = batchSummary.results
    .filter((row) => row.execution_state === "dry_run_ready")
    .map((row) => row.username);
  const notAttemptedUsernames = Array.isArray(batchSummary.not_attempted_rows)
    ? batchSummary.not_attempted_rows.map((row) => row.username).filter(Boolean)
    : [];

  console.log("");
  console.log(
    `Execution complete. sent=${sentCount} sent_persist_failed=${sentPersistFailedCount} dry_run_ready=${readyCount} blocked=${blockedCount} failed=${failedCount}`
  );
  if (sentUsernames.length) console.log(`Sent usernames: ${sentUsernames.join(", ")}`);
  if (sentPersistFailedUsernames.length) {
    console.log(`Sent with persist-failed usernames: ${sentPersistFailedUsernames.join(", ")}`);
  }
  if (dryRunReadyUsernames.length) {
    console.log(`Dry-run ready usernames: ${dryRunReadyUsernames.join(", ")}`);
  }
  if (blockedUsernames.length) console.log(`Blocked usernames: ${blockedUsernames.join(", ")}`);
  if (failedUsernames.length) console.log(`Failed usernames: ${failedUsernames.join(", ")}`);
  if (notAttemptedUsernames.length) {
    console.log(`Not attempted usernames: ${notAttemptedUsernames.join(", ")}`);
  }
  if (batchSummary.aborted_reason) {
    console.log(`Batch aborted: ${batchSummary.aborted_reason}`);
  }
  console.log(`Batch summary: ${path.relative(REPO_ROOT, batchDir)}/summary.json`);
}

main().catch((error) => {
  console.error("");
  console.error("Execute safe followups failed before completion.");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
