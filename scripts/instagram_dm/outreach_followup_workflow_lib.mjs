import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  connectToBrowser,
  deriveThreadIdFromUrl,
  ensureDir,
  getFreshPage,
  getSupabaseAdminClient,
  gotoInbox,
  loadLocalEnvFiles,
  normalizeUsername,
  runResolvedLeadNetworkCheckWithPage,
  saveJson,
  sendMessageInOpenThread,
  slugify,
} from "./thread_network_pipeline_lib.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, "..", "..");
export const OUTPUT_DIR = path.join(__dirname, "output");
export const DEFAULT_BRIDGE_HOST = "127.0.0.1";
export const DEFAULT_BRIDGE_PORT = 4471;
export const WORKFLOW_BUCKETS = {
  actionable: "actionable",
  missing_thread: "missing_thread",
  ready_followup: "ready_followup",
  manual_review: "manual_review",
  wait_window_not_met: "wait_window_not_met",
  all: "all",
};
const SAFE_STATES = new Set(["safe_unseen_no_reply", "safe_seen_no_reply"]);
const THREAD_RESOLUTION_FAILURE_STATES = new Set([
  "thread_resolution_failed_search",
  "thread_resolution_failed_verification",
]);
const INITIAL_OUTREACH_ANCHOR_PATTERNS = [
  /want\s+the\s+full\s+version\??/i,
  /\bfull\s+version\??\b/i,
];

const FOLLOWUP_MESSAGE_VARIANTS = {
  1: [
    "Did the carousel angle feel right for your audience, or would a different style land better?",
    "Curious if that carousel format fits how you usually speak to your audience, or if you'd want a different direction.",
    "Do you think that carousel approach matches your brand voice, or should I try a different visual angle?",
    "Would that carousel style work for your audience, or do you think another format would make more sense?",
    "Wanted to get your read: does that carousel format feel on-brand for your audience, or would you want a different look?",
  ],
  2: [
    "Just making sure this didn't get buried. The carousel is yours either way if you want me to send it over.",
    "Wanted to bump this once in case it got missed. Happy to send the carousel if you want it.",
    "Circling back in case this slipped by. If you want the carousel, I can send it over.",
    "Quick follow-up here. The carousel is yours to use if you'd like me to send the full version.",
    "Just resurfacing this once. If you want the carousel, I can send it across.",
  ],
  3: [
    "No worries if now isn't the right time. I'll hop out of your inbox, but if you ever want to test carousels, I'm happy to help.",
    "All good if this isn't a priority right now. I'll leave it here, and if you want to revisit carousels later, just let me know.",
    "Totally fine if the timing's off. I'll close the loop here, but the offer's open if you ever want to try carousels.",
    "No pressure at all if this isn't something you're focused on. I'll step back, and if carousels become relevant later, feel free to reach out.",
    "If this isn't on your radar right now, no problem. I'll leave you alone after this, but I'm here if you ever want to test the carousel route.",
  ],
};

const PLATFORM_FRICTION_ERROR_PATTERNS = [
  /action\s+blocked/i,
  /try\s+again\s+later/i,
  /feedback\s+required/i,
  /temporarily\s+blocked/i,
  /challenge[_\s-]*required/i,
  /checkpoint/i,
  /we\s+restrict\s+certain\s+activity/i,
  /please\s+wait\s+a\s+few\s+minutes/i,
  /rate\s+limit/i,
];

const DELIVERY_ANOMALY_ERROR_PATTERNS = [
  /message\s+send\s+could\s+not\s+be\s+verified/i,
  /message\s+could\s+not\s+be\s+sent/i,
  /failed\s+to\s+click\s+send/i,
];

const RESOLVER_FAILURE_SPIKE_WINDOW = 4;
const RESOLVER_FAILURE_SPIKE_THRESHOLD = 3;

const INTERNAL_LIVE_HUMANIZATION_PROFILE = Object.freeze({
  enabled: true,
  profile: "normal",
  typing: {
    enabled: true,
    maxTypingBudgetMs: 12000,
    minChunkSize: 1,
    maxChunkSize: 1,
    pauseMinMs: 70,
    pauseMaxMs: 260,
    spacePauseMinMs: 110,
    spacePauseMaxMs: 420,
    punctuationPauseMinMs: 220,
    punctuationPauseMaxMs: 700,
    hesitationChance: 0.22,
    hesitationMinMs: 320,
    hesitationMaxMs: 1400,
    quickBurstChance: 0.2,
    quickBurstMultiplierMin: 0.35,
    quickBurstMultiplierMax: 0.75,
    slowStartChars: 5,
    slowStartMultiplierMin: 1.2,
    slowStartMultiplierMax: 2.2,
  },
  search: {
    enabled: true,
    maxTypingBudgetMs: 7000,
    minChunkSize: 1,
    maxChunkSize: 1,
    pauseMinMs: 90,
    pauseMaxMs: 320,
    spacePauseMinMs: 130,
    spacePauseMaxMs: 500,
    punctuationPauseMinMs: 260,
    punctuationPauseMaxMs: 850,
    hesitationChance: 0.28,
    hesitationMinMs: 500,
    hesitationMaxMs: 1800,
    quickBurstChance: 0.16,
    quickBurstMultiplierMin: 0.4,
    quickBurstMultiplierMax: 0.8,
    slowStartChars: 4,
    slowStartMultiplierMin: 1.3,
    slowStartMultiplierMax: 2.4,
    preFocusPauseMs: { minMs: 280, maxMs: 900 },
    postTypeSettleMs: { minMs: 2600, maxMs: 3800 },
  },
  idle: {
    initialPauseMsMin: 900,
    initialPauseMsMax: 2400,
    microPauseMsMin: 350,
    microPauseMsMax: 1100,
    scrollChance: 0.45,
    returnScrollChance: 0.7,
    scrollMinPx: 70,
    scrollMaxPx: 180,
  },
  longPause: {
    chance: 0.15,
    minMs: 3500,
    maxMs: 9000,
  },
  delayTails: {
    preSend: { chance: 0.35, minMs: 450, maxMs: 2600 },
    postSend: { chance: 0.22, minMs: 250, maxMs: 1800 },
    interLead: { chance: 0.45, minMs: 2000, maxMs: 9000 },
  },
});

function s(value) {
  const out = typeof value === "string" ? value.trim() : "";
  return out || null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

function todayYmdUtc() {
  const d = new Date();
  return `${String(d.getUTCFullYear())}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
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

async function sleepWithCancel(ms, shouldCancel) {
  const totalMs = Number.isFinite(ms) ? Math.max(0, Math.floor(ms)) : 0;
  if (totalMs <= 0) return false;
  const stepMs = 500;
  let elapsed = 0;
  while (elapsed < totalMs) {
    if (typeof shouldCancel === "function" && shouldCancel()) return true;
    const waitMs = Math.min(stepMs, totalMs - elapsed);
    await sleep(waitMs);
    elapsed += waitMs;
  }
  return typeof shouldCancel === "function" && shouldCancel();
}

function randomChance(probability) {
  const p = Number(probability);
  if (!Number.isFinite(p) || p <= 0) return false;
  if (p >= 1) return true;
  return Math.random() < p;
}

function sampleDelayWithTail(range, tailConfig = null) {
  const baseMs = randomIntBetween(range?.min ?? 0, range?.max ?? 0);
  const chance = Number(tailConfig?.chance);
  const tailExtraMs =
    Number.isFinite(chance) && chance > 0 && randomChance(chance)
      ? randomIntBetween(tailConfig?.minMs ?? 0, tailConfig?.maxMs ?? 0)
      : 0;
  return {
    base_ms: baseMs,
    tail_extra_ms: tailExtraMs,
    total_ms: baseMs + tailExtraMs,
  };
}

function sampleOptionalDelay(config = null) {
  const fired = randomChance(config?.chance);
  const delayMs = fired ? randomIntBetween(config?.minMs ?? 0, config?.maxMs ?? 0) : 0;
  return {
    fired,
    delay_ms: delayMs,
  };
}

async function trySmallVerticalThreadScroll(page, deltaPx) {
  const requestedPx = Number.isFinite(Number(deltaPx)) ? Math.trunc(Number(deltaPx)) : 0;
  if (!requestedPx) {
    return {
      ok: false,
      requested_px: 0,
      applied_px: 0,
      reason: "no_delta",
    };
  }
  return page
    .evaluate((delta) => {
      const candidates = Array.from(document.querySelectorAll("main, section, div"))
        .map((el) => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const scrollable =
            (style.overflowY === "auto" || style.overflowY === "scroll") &&
            el.scrollHeight > el.clientHeight + 60 &&
            rect.height > 140 &&
            rect.bottom > 0 &&
            rect.top < window.innerHeight;
          if (!scrollable) return null;
          return {
            el,
            area: rect.height * Math.max(rect.width, 1),
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.area - a.area);
      const target = candidates[0]?.el || null;
      if (!target) {
        return {
          ok: false,
          requested_px: delta,
          applied_px: 0,
          reason: "no_scrollable_container",
        };
      }
      const before = target.scrollTop;
      target.scrollTop = before + delta;
      const after = target.scrollTop;
      return {
        ok: after !== before,
        requested_px: delta,
        applied_px: after - before,
        before_scroll_top: before,
        after_scroll_top: after,
      };
    }, requestedPx)
    .catch((error) => ({
      ok: false,
      requested_px: requestedPx,
      applied_px: 0,
      reason: error instanceof Error ? error.message : String(error),
    }));
}

async function runHumanizedThreadIdle({ page, idleConfig, shouldCancel }) {
  const summary = {
    enabled: true,
    initial_pause_ms: randomIntBetween(
      idleConfig?.initialPauseMsMin ?? 0,
      idleConfig?.initialPauseMsMax ?? 0
    ),
    micro_pause_ms: 0,
    return_pause_ms: 0,
    scrolled: false,
    scroll_up: null,
    scroll_down: null,
    cancelled: false,
  };

  summary.cancelled = await sleepWithCancel(summary.initial_pause_ms, shouldCancel);
  if (summary.cancelled) return summary;

  if (!randomChance(idleConfig?.scrollChance)) {
    return summary;
  }

  const upwardPx = -randomIntBetween(idleConfig?.scrollMinPx ?? 0, idleConfig?.scrollMaxPx ?? 0);
  summary.scroll_up = await trySmallVerticalThreadScroll(page, upwardPx);
  summary.scrolled = !!summary.scroll_up?.ok;

  summary.micro_pause_ms = randomIntBetween(idleConfig?.microPauseMsMin ?? 0, idleConfig?.microPauseMsMax ?? 0);
  summary.cancelled = await sleepWithCancel(summary.micro_pause_ms, shouldCancel);
  if (summary.cancelled) return summary;

  if (summary.scrolled && randomChance(idleConfig?.returnScrollChance)) {
    const downPx = Math.abs(upwardPx) + randomIntBetween(10, 45);
    summary.scroll_down = await trySmallVerticalThreadScroll(page, downPx);
    summary.return_pause_ms = randomIntBetween(
      idleConfig?.microPauseMsMin ?? 0,
      idleConfig?.microPauseMsMax ?? 0
    );
    summary.cancelled = await sleepWithCancel(summary.return_pause_ms, shouldCancel);
  }

  return summary;
}

function getNextFollowupNumber(row) {
  const raw = row?.followup_sent_count;
  if (raw === null || raw === undefined) return 1;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.floor(n) + 1;
}

function getFollowupMessageOptions(nextFollowupNumber) {
  return Array.isArray(FOLLOWUP_MESSAGE_VARIANTS?.[nextFollowupNumber])
    ? FOLLOWUP_MESSAGE_VARIANTS[nextFollowupNumber]
    : [];
}

function getFollowupMessage(nextFollowupNumber) {
  return getFollowupMessageOptions(nextFollowupNumber)[0] || null;
}

function pickRandomArrayItem(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const idx = randomIntBetween(0, items.length - 1);
  return {
    value: items[idx],
    index: idx,
    count: items.length,
  };
}

function pickFollowupMessageVariant(nextFollowupNumber) {
  const pick = pickRandomArrayItem(getFollowupMessageOptions(nextFollowupNumber));
  return {
    message: String(pick?.value || "").trim() || null,
    variant_index: Number.isFinite(pick?.index) ? pick.index + 1 : null,
    variant_count: Number.isFinite(pick?.count) ? pick.count : 0,
  };
}

function messageMatchesAnyPattern(message, patterns) {
  const raw = String(message || "");
  if (!raw) return false;
  return Array.isArray(patterns) && patterns.some((pattern) => pattern.test(raw));
}

function detectImmediateFrictionStop({ executionRecord, errorReason }) {
  const message = String(errorReason || executionRecord?.error_reason || "").trim();
  if (!message) return null;
  if (messageMatchesAnyPattern(message, PLATFORM_FRICTION_ERROR_PATTERNS)) {
    return {
      reason: "platform_friction_detected",
      detail: message,
    };
  }
  if (
    String(executionRecord?.execution_state || "") === "send_failed" &&
    messageMatchesAnyPattern(message, DELIVERY_ANOMALY_ERROR_PATTERNS)
  ) {
    return {
      reason: "delivery_anomaly_detected",
      detail: message,
    };
  }
  return null;
}

function updateResolverFailureWindow(windowState, { attemptedResolution, resolutionFailed }) {
  if (!attemptedResolution) return;
  windowState.push({
    ok: !resolutionFailed,
    ts: Date.now(),
  });
  while (windowState.length > RESOLVER_FAILURE_SPIKE_WINDOW) {
    windowState.shift();
  }
}

function detectResolverFailureSpike(windowState) {
  if (!Array.isArray(windowState) || windowState.length < RESOLVER_FAILURE_SPIKE_WINDOW) {
    return null;
  }
  const failureCount = windowState.filter((item) => item?.ok === false).length;
  if (failureCount >= RESOLVER_FAILURE_SPIKE_THRESHOLD) {
    return {
      reason: "resolver_failure_spike",
      detail: `${failureCount}/${windowState.length} recent thread resolutions failed`,
    };
  }
  return null;
}

function normalizeMessageText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getOutboundLoadedMessagePreviews(analysisResult) {
  const outbound = Array.isArray(analysisResult?.outbound_loaded_messages)
    ? analysisResult.outbound_loaded_messages
    : [];
  return outbound
    .map((message) => String(message?.text_preview || "").trim())
    .filter(Boolean);
}

function findInitialOutreachAnchorMatch(analysisResult) {
  const previews = getOutboundLoadedMessagePreviews(analysisResult);
  for (const preview of previews) {
    const normalized = normalizeMessageText(preview);
    if (!normalized) continue;
    for (const pattern of INITIAL_OUTREACH_ANCHOR_PATTERNS) {
      if (pattern.test(normalized)) {
        return preview;
      }
    }
  }
  return null;
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

function getBucketMatchesFilter(bucket, decision) {
  if (bucket === WORKFLOW_BUCKETS.all) return true;
  if (bucket === WORKFLOW_BUCKETS.actionable) {
    return decision.workflow_bucket === WORKFLOW_BUCKETS.missing_thread || decision.workflow_bucket === WORKFLOW_BUCKETS.ready_followup;
  }
  return decision.workflow_bucket === bucket;
}

async function loadWorkflowRows({ supabase, accountId, usernameFilter }) {
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
        "instagram_dm_thread_discovered_at",
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
  if (!Array.isArray(leadIds) || leadIds.length === 0) return guardMap;

  const hours = clampInt(duplicateGuardHours, 72, 1);
  const cutoffIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const leadIdSet = new Set(
    leadIds
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
  const { data, error } = await supabase
    .from("editor_outreach_dm_execution_events")
    .select("outreach_target_id, followup_number, created_at, event_type")
    .eq("account_id", accountId)
    .eq("event_type", "sent_followup")
    .gte("created_at", cutoffIso);

  if (error) {
    throw new Error(
      [error.message, error.details, error.hint].filter(Boolean).join(" | ") || "Failed to load recent successful send guards."
    );
  }

  for (const row of Array.isArray(data) ? data : []) {
    const leadId = String(row?.outreach_target_id || "").trim();
    const followupNumber = Number(row?.followup_number);
    const createdAt = String(row?.created_at || "").trim();
    if (!leadIdSet.has(leadId)) continue;
    if (!leadId || !Number.isFinite(followupNumber) || !createdAt) continue;
    const key = `${leadId}:${Math.floor(followupNumber)}`;
    const existing = guardMap.get(key);
    if (!existing || Date.parse(createdAt) > Date.parse(existing)) {
      guardMap.set(key, createdAt);
    }
  }
  return guardMap;
}

function buildWorkflowDecision(row, minDaysSinceLastContact, recentSuccessfulFollowups = new Map()) {
  const leadId = String(row?.id || "").trim();
  const username = normalizeUsername(row?.prospect_username) || normalizeUsername(row?.username) || "";
  const threadUrl = s(row?.instagram_dm_thread_url);
  const state = s(row?.instagram_dm_thread_last_state);
  const nextFollowupNumber = getNextFollowupNumber(row);
  const followupMessage = getFollowupMessage(nextFollowupNumber);
  const anchor = getEligibilityAnchor(row, nextFollowupNumber);
  const daysSinceLastContact = anchor.days_since_contact;
  const recentSuccessAt = leadId
    ? recentSuccessfulFollowups.get(`${leadId}:${nextFollowupNumber}`) || null
    : null;
  const hasKnownThread = !!threadUrl;
  const lastExecutionState = s(row?.instagram_dm_last_execution_state);

  const base = {
    lead_id: leadId || null,
    username: username || null,
    thread_url: threadUrl,
    thread_known: hasKnownThread,
    thread_id: s(row?.instagram_dm_thread_id),
    classification_state: state,
    recommended_action: s(row?.instagram_dm_thread_last_recommended_action),
    next_followup_number: nextFollowupNumber,
    followup_message: followupMessage,
    contact_anchor_type: anchor.anchor_type,
    contact_anchor_value: anchor.anchor_value,
    days_since_last_contact: Number.isFinite(daysSinceLastContact) ? daysSinceLastContact : null,
    recent_success_at: recentSuccessAt,
    workflow_bucket: "manual_review",
    next_action: "Manual review",
    eligible_for_run: false,
    exclude_reason: null,
  };

  if (!username) return { ...base, workflow_bucket: "data_issue", next_action: "Manual review", exclude_reason: "missing_username" };
  if (nextFollowupNumber > 3 || !followupMessage) {
    return {
      ...base,
      workflow_bucket: "followup_cap_reached",
      next_action: "Wait",
      exclude_reason: "followup_cap_reached",
    };
  }
  if (recentSuccessAt) {
    return {
      ...base,
      workflow_bucket: "wait_window_not_met",
      next_action: "Wait",
      exclude_reason: "duplicate_send_guard_recent_success",
    };
  }
  if (!anchor.anchor_value || !Number.isFinite(daysSinceLastContact)) {
    return {
      ...base,
      workflow_bucket: "data_issue",
      next_action: "Manual review",
      exclude_reason: "invalid_contact_anchor",
    };
  }
  if (daysSinceLastContact < minDaysSinceLastContact) {
    return {
      ...base,
      workflow_bucket: WORKFLOW_BUCKETS.wait_window_not_met,
      next_action: "Wait",
      exclude_reason: "wait_window_not_met",
    };
  }

  if (!hasKnownThread) {
    if (THREAD_RESOLUTION_FAILURE_STATES.has(String(lastExecutionState || ""))) {
      return {
        ...base,
        workflow_bucket: WORKFLOW_BUCKETS.manual_review,
        next_action: "Manual review",
        exclude_reason: "missing_thread_resolution_failed",
      };
    }
    return {
      ...base,
      workflow_bucket: WORKFLOW_BUCKETS.missing_thread,
      next_action: "Resolve thread",
      eligible_for_run: true,
    };
  }

  if (SAFE_STATES.has(String(state || ""))) {
    return {
      ...base,
      workflow_bucket: WORKFLOW_BUCKETS.ready_followup,
      next_action: `Follow-up ${nextFollowupNumber}`,
      eligible_for_run: true,
    };
  }

  if (state === "review_replied_or_ongoing" || state === "review_ambiguous") {
    return {
      ...base,
      workflow_bucket: WORKFLOW_BUCKETS.manual_review,
      next_action: "Manual review",
      exclude_reason: "manual_review_state",
    };
  }

  return {
    ...base,
    workflow_bucket: WORKFLOW_BUCKETS.manual_review,
    next_action: "Manual review",
    exclude_reason: "known_thread_missing_safe_state",
  };
}

function sortWorkflowEntries(entries) {
  return [...entries].sort((a, b) => {
    const aAnchor = a?.decision?.contact_anchor_type === "created_at"
      ? Date.parse(String(a?.decision?.contact_anchor_value || "")) || 0
      : parseYmdUtcMs(String(a?.decision?.contact_anchor_value || ""));
    const bAnchor = b?.decision?.contact_anchor_type === "created_at"
      ? Date.parse(String(b?.decision?.contact_anchor_value || "")) || 0
      : parseYmdUtcMs(String(b?.decision?.contact_anchor_value || ""));
    if (aAnchor !== bAnchor) return aAnchor - bAnchor;
    return String(a?.decision?.username || "").localeCompare(String(b?.decision?.username || ""));
  });
}

async function buildWorkflowPreviewData({
  accountId,
  usernames = [],
  bucket = WORKFLOW_BUCKETS.actionable,
  limit = 25,
  offset = 0,
  minDaysSinceLastContact = 4,
  duplicateGuardHours = 72,
}) {
  await loadLocalEnvFiles(REPO_ROOT);
  const supabase = getSupabaseAdminClient();
  const usernameFilter = new Set((Array.isArray(usernames) ? usernames : []).map((v) => normalizeUsername(v)).filter(Boolean));
  const rows = await loadWorkflowRows({ supabase, accountId, usernameFilter });
  const recentSuccessfulFollowups = await loadRecentSuccessfulSendGuards({
    supabase,
    accountId,
    leadIds: rows.map((row) => String(row?.id || "").trim()).filter(Boolean),
    duplicateGuardHours,
  });
  const evaluated = rows.map((row) => ({
    row,
    decision: buildWorkflowDecision(row, minDaysSinceLastContact, recentSuccessfulFollowups),
  }));
  const countsByBucket = {};
  const exclusionReasonCounts = {};
  for (const entry of evaluated) {
    const workflowBucket = String(entry?.decision?.workflow_bucket || "unknown");
    countsByBucket[workflowBucket] = (countsByBucket[workflowBucket] || 0) + 1;
    if (!entry?.decision?.eligible_for_run) {
      const reason = String(entry?.decision?.exclude_reason || "ineligible");
      exclusionReasonCounts[reason] = (exclusionReasonCounts[reason] || 0) + 1;
    }
  }
  const matching = sortWorkflowEntries(
    evaluated.filter((entry) => entry.decision.eligible_for_run && getBucketMatchesFilter(bucket, entry.decision))
  );
  const selected = matching.slice(offset, offset + limit);

  return {
    supabase,
    rows,
    evaluated,
    matching,
    selected,
    countsByBucket,
    exclusionReasonCounts,
    preview: {
      account_id: accountId,
      bucket,
      total_candidates: rows.length,
      total_matching: matching.length,
      total_selected: selected.length,
      limit,
      offset,
      min_days_since_last_contact: minDaysSinceLastContact,
      duplicate_guard_hours: duplicateGuardHours,
      counts_by_bucket: countsByBucket,
      exclusion_reason_counts: exclusionReasonCounts,
      selected_preview: selected.slice(0, 20).map(({ decision }) => ({
        lead_id: decision.lead_id,
        username: decision.username,
        next_action: decision.next_action,
        workflow_bucket: decision.workflow_bucket,
        next_followup_number: decision.next_followup_number,
        thread_known: decision.thread_known,
      })),
    },
  };
}

async function insertExecutionEvent(supabase, event) {
  const { error } = await supabase.from("editor_outreach_dm_execution_events").insert(event);
  if (error) throw new Error(error.message);
}

async function updateRowById(supabase, { accountId, leadId, patch }) {
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

  await updateRowById(supabase, { accountId, leadId, patch });

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

async function persistThreadResolution({
  supabase,
  accountId,
  leadId,
  username,
  threadUrl,
  threadId,
  discoveredAt,
  runDir,
}) {
  await updateRowById(supabase, {
    accountId,
    leadId,
    patch: {
      instagram_dm_thread_url: threadUrl,
      instagram_dm_thread_id: threadId,
      instagram_dm_thread_discovered_at: discoveredAt,
    },
  });

  await insertExecutionEvent(supabase, {
    account_id: accountId,
    outreach_target_id: leadId,
    username,
    thread_url: threadUrl,
    event_type: "thread_resolution_succeeded",
    followup_number: null,
    message_text: null,
    classification_state: null,
    recommended_action: null,
    artifact_path: runDir,
    error_message: null,
  });
}

function classifyResolutionFailure(errorMessage, hadStoredThread) {
  const message = String(errorMessage || "");
  if (!hadStoredThread) {
    if (/No matching inbox result was found/i.test(message)) {
      return "thread_resolution_failed_search";
    }
    if (/participant verification failed/i.test(message)) {
      return "thread_resolution_failed_verification";
    }
    if (/did not produce a \/direct\/t\//i.test(message) || /Could not find the inbox search input/i.test(message)) {
      return "thread_resolution_failed_search";
    }
  }
  return null;
}

function emitLog(logs, onEvent, message, patch = null) {
  logs.push(message);
  if (logs.length > 200) logs.shift();
  if (typeof onEvent === "function") {
    onEvent({ type: "log", message, patch });
  }
}

export async function previewUnifiedWorkflow(args) {
  const accountId = String(args?.accountId || "").trim();
  if (!accountId) throw new Error("accountId is required");
  if (!isUuid(accountId)) {
    throw new Error(`Invalid accountId format: ${accountId}`);
  }
  const bucket = args?.bucket || WORKFLOW_BUCKETS.actionable;
  const limit = clampInt(args?.limit, 25, 1);
  const offset = clampInt(args?.offset, 0, 0);
  const minDaysSinceLastContact = clampInt(args?.minDaysSinceLastContact, 4, 1);
  const duplicateGuardHours = clampInt(args?.duplicateGuardHours, 72, 1);
  const { preview } = await buildWorkflowPreviewData({
    accountId,
    usernames: args?.usernames || [],
    bucket,
    limit,
    offset,
    minDaysSinceLastContact,
    duplicateGuardHours,
  });
  return preview;
}

export async function runUnifiedWorkflowBatch(rawArgs = {}) {
  const accountId = String(rawArgs?.accountId || "").trim();
  if (!accountId) throw new Error("accountId is required");
  if (!isUuid(accountId)) {
    throw new Error(`Invalid accountId format: ${accountId}`);
  }

  await loadLocalEnvFiles(REPO_ROOT);

  const bucket = rawArgs?.bucket || WORKFLOW_BUCKETS.actionable;
  const limit = clampInt(rawArgs?.limit, 25, 1);
  const offset = clampInt(rawArgs?.offset, 0, 0);
  const minDaysSinceLastContact = clampInt(rawArgs?.minDaysSinceLastContact, 4, 1);
  const duplicateGuardHours = clampInt(rawArgs?.duplicateGuardHours, 72, 1);
  const maxSends = clampInt(rawArgs?.maxSends, 10, 1);
  const stopAfterFailures = clampInt(rawArgs?.stopAfterFailures, 3, 1);
  const sendLive = !!rawArgs?.sendLive;
  const usernames = Array.isArray(rawArgs?.usernames) ? rawArgs.usernames : [];
  const runLabel = String(rawArgs?.runLabel || "").trim();
  const debuggerUrl = String(rawArgs?.debuggerUrl || "http://127.0.0.1:9222").trim();
  const interLeadDelay = normalizeDelayRange(rawArgs?.delayMsMin, rawArgs?.delayMsMax, 2000, 5000);
  const preSendDelay = normalizeDelayRange(
    rawArgs?.preSendDelayMsMin,
    rawArgs?.preSendDelayMsMax,
    1000,
    2500
  );
  const postSendDelay = normalizeDelayRange(
    rawArgs?.postSendDelayMsMin,
    rawArgs?.postSendDelayMsMax,
    1000,
    2000
  );
  const liveHumanization = sendLive ? INTERNAL_LIVE_HUMANIZATION_PROFILE : null;

  const batchTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const batchIdBase = `unified-followup-workflow-${batchTimestamp}`;
  const batchId = runLabel ? `${batchIdBase}-${slugify(runLabel)}` : batchIdBase;
  const batchDir = path.join(OUTPUT_DIR, "unified_workflow_batches", batchId);
  await ensureDir(batchDir);

  const previewData = await buildWorkflowPreviewData({
    accountId,
    usernames,
    bucket,
    limit,
    offset,
    minDaysSinceLastContact,
    duplicateGuardHours,
  });
  const { supabase, selected, matching, rows, countsByBucket, exclusionReasonCounts, preview } = previewData;
  const logs = [];
  const isCancelled = () => (typeof rawArgs?.shouldCancel === "function" ? !!rawArgs.shouldCancel() : false);

  function cancelRemainingRows(startIdx, reason = "cancelled_by_user") {
    batchSummary.aborted_reason = reason;
    batchSummary.not_attempted_rows = selected.slice(startIdx).map(({ decision }) => ({
      lead_id: decision.lead_id,
      username: decision.username,
      reason,
    }));
  }

  const batchSummary = {
    account_id: accountId,
    batch_id: batchId,
    created_at: new Date().toISOString(),
    bucket,
    dry_run: !sendLive,
    limit,
    offset,
    min_days_since_last_contact: minDaysSinceLastContact,
    total_candidates: rows.length,
    total_matching: matching.length,
    total_selected: selected.length,
    max_sends: maxSends,
    stop_after_failures: stopAfterFailures,
    duplicate_guard_hours: duplicateGuardHours,
    delay_ms_range: interLeadDelay,
    pre_send_delay_ms_range: preSendDelay,
    post_send_delay_ms_range: postSendDelay,
    humanization: liveHumanization
      ? {
          enabled: true,
          profile: liveHumanization.profile,
          scope: "unified_runner_send_live_only",
        }
      : {
          enabled: false,
          profile: "off",
          scope: "disabled",
        },
    counts_by_bucket: countsByBucket,
    exclusion_reason_counts: exclusionReasonCounts,
    aborted_reason: null,
    preview,
    not_attempted_rows: [],
    results: [],
  };

  emitLog(
    logs,
    rawArgs?.onEvent,
    `Loaded ${rows.length} workflow candidates for account ${accountId}; processing ${selected.length} selected lead(s) in bucket ${bucket} (${sendLive ? "send-live" : "dry-run"}).`,
    { batchSummary }
  );

  if (!selected.length) {
    await saveJson(path.join(batchDir, "summary.json"), batchSummary);
    return {
      ok: true,
      batch_id: batchId,
      batch_dir: path.relative(REPO_ROOT, batchDir),
      summary_path: path.relative(REPO_ROOT, path.join(batchDir, "summary.json")),
      summary: batchSummary,
      logs,
    };
  }

  if (isCancelled()) {
    cancelRemainingRows(0);
    emitLog(logs, rawArgs?.onEvent, "Stopping batch before browser connect: cancellation requested.");
    await saveJson(path.join(batchDir, "summary.json"), batchSummary);
    return {
      ok: true,
      batch_id: batchId,
      batch_dir: path.relative(REPO_ROOT, batchDir),
      summary_path: path.relative(REPO_ROOT, path.join(batchDir, "summary.json")),
      summary: batchSummary,
      logs,
    };
  }

  const browser = await connectToBrowser(debuggerUrl);
  emitLog(logs, rawArgs?.onEvent, `Connected to Chrome via ${debuggerUrl}`);

  let successfulSendCount = 0;
  let consecutiveFailureCount = 0;
  const recentResolverAttempts = [];
  let sharedMissingThreadPage = null;

  try {
    for (let idx = 0; idx < selected.length; idx += 1) {
      if (isCancelled()) {
        cancelRemainingRows(idx);
        emitLog(logs, rawArgs?.onEvent, `Stopping batch before item ${idx + 1}: cancellation requested.`);
        break;
      }
      if (sendLive && successfulSendCount >= maxSends) {
        batchSummary.aborted_reason = "max_sends_reached";
        batchSummary.not_attempted_rows = selected.slice(idx).map(({ decision }) => ({
          lead_id: decision.lead_id,
          username: decision.username,
          reason: "max_sends_reached",
        }));
        emitLog(logs, rawArgs?.onEvent, `Stopping batch before item ${idx + 1}: max sends reached (${maxSends}).`);
        break;
      }
      if (consecutiveFailureCount >= stopAfterFailures) {
        batchSummary.aborted_reason = "failure_threshold_reached";
        batchSummary.not_attempted_rows = selected.slice(idx).map(({ decision }) => ({
          lead_id: decision.lead_id,
          username: decision.username,
          reason: "failure_threshold_reached",
        }));
        emitLog(
          logs,
          rawArgs?.onEvent,
          `Stopping batch before item ${idx + 1}: consecutive failures reached (${stopAfterFailures}).`
        );
        break;
      }

      const { row, decision } = selected[idx];
      const label = `[${idx + 1}/${selected.length}] ${decision.username}`;
      let retainedPage = null;
      let sendWasCompleted = false;
      let cancelBatchAfterRecord = false;
      let postRecordAbort = null;
      let chosenFollowup = {
        message: decision.followup_message,
        variant_index: null,
        variant_count: getFollowupMessageOptions(decision.next_followup_number).length,
      };
      const hadStoredThread = !!s(row?.instagram_dm_thread_url);
      const shouldUseSharedMissingThreadPage = sendLive && !hadStoredThread;
      const executionRecord = {
        ok: false,
        lead_id: decision.lead_id,
        username: decision.username,
        workflow_bucket: decision.workflow_bucket,
        next_action: decision.next_action,
        thread_url: decision.thread_url,
        run_dir: null,
        followup_number: decision.next_followup_number,
        selected_followup_message: null,
        selected_followup_variant_index: null,
        selected_followup_variant_count: chosenFollowup.variant_count || 0,
        dry_run: !sendLive,
        selected_state: decision.classification_state,
        selected_recommended_action: decision.recommended_action,
        selected_last_contact_date: s(row?.last_contact_date),
        days_since_last_contact: decision.days_since_last_contact,
        contact_anchor_type: decision.contact_anchor_type,
        contact_anchor_value: decision.contact_anchor_value,
        execution_state: null,
        live_classification_state: null,
        live_recommended_action: null,
        initial_outreach_anchor_match: null,
        send_verification_method: null,
        thread_resolution_state: null,
        humanization: liveHumanization
          ? {
              enabled: true,
              profile: liveHumanization.profile,
              idle: null,
              long_pause: null,
              pre_send_delay: null,
              post_send_delay: null,
              inter_lead_delay: null,
              typing: null,
            }
          : {
              enabled: false,
              profile: "off",
            },
        error_reason: null,
      };

      try {
        if (shouldUseSharedMissingThreadPage && !sharedMissingThreadPage) {
          sharedMissingThreadPage = (await getFreshPage(browser)).page;
          emitLog(logs, rawArgs?.onEvent, `${label} -> created shared missing-thread resolver page`);
        }

        const networkCheck = await runResolvedLeadNetworkCheckWithPage({
          browser,
          outputDir: OUTPUT_DIR,
          runLabel: batchId,
          stepLabel: label,
          leadId: decision.lead_id,
          username: decision.username,
          row,
          threadUrlOverride: decision.thread_url || "",
          projectRoot: REPO_ROOT,
          resolverHumanization: sendLive ? liveHumanization.search : null,
          resolverWaitFn: sendLive ? (ms) => sleepWithCancel(ms, isCancelled) : null,
          providedPage: shouldUseSharedMissingThreadPage ? sharedMissingThreadPage : null,
          preferDirectCaptureAfterSearchOpen: shouldUseSharedMissingThreadPage,
          fallbackReopenAfterSearchCaptureMiss: shouldUseSharedMissingThreadPage,
        });

        executionRecord.run_dir = networkCheck?.run_dir || null;
        executionRecord.live_classification_state = s(
          networkCheck?.classification_result?.classification_state
        );
        executionRecord.live_recommended_action = s(
          networkCheck?.classification_result?.recommended_action
        );
        executionRecord.initial_outreach_anchor_match = s(
          findInitialOutreachAnchorMatch(networkCheck?.analysis_result)
        );
        if (sendLive && networkCheck?.capture_result?.search_humanization?.enabled) {
          const searchHumanization = networkCheck.capture_result.search_humanization;
          emitLog(
            logs,
            rawArgs?.onEvent,
            `${label} -> search humanization pre_focus=${searchHumanization?.pre_focus_pause_ms ?? 0}ms post_type=${searchHumanization?.post_type_settle_ms ?? 0}ms typing_elapsed=${searchHumanization?.typing?.typing_elapsed_ms ?? 0}ms typing_mode=${searchHumanization?.typing?.mode || "unknown"} hesitations=${searchHumanization?.typing?.hesitation_count ?? 0} bursts=${searchHumanization?.typing?.quick_burst_count ?? 0}`
          );
        }

        if (!networkCheck?.ok || !networkCheck?.page) {
          throw new Error(networkCheck?.error_reason || "Workflow check failed.");
        }

        const page = networkCheck.page;
        const pageIsSharedResolverPage =
          !!sharedMissingThreadPage && shouldUseSharedMissingThreadPage && page === sharedMissingThreadPage;
        retainedPage = pageIsSharedResolverPage ? null : page;
        const closeLeadPage = async () => {
          if (!pageIsSharedResolverPage) {
            await page.close().catch(() => {});
          }
          retainedPage = null;
        };
        const liveThreadUrl = s(networkCheck?.capture_result?.thread_url);
        const liveThreadId =
          s(networkCheck?.capture_result?.thread_id) || deriveThreadIdFromUrl(liveThreadUrl);
        const discoveredNewThread = !hadStoredThread && !!liveThreadUrl;
        const classificationState = String(
          networkCheck?.classification_result?.classification_state || ""
        ).trim();
        const recommendedAction = String(
          networkCheck?.classification_result?.recommended_action || ""
        ).trim();

        if (isCancelled()) {
          executionRecord.execution_state = "cancelled_by_user";
          executionRecord.error_reason = "Cancellation requested before send decision.";
          emitLog(logs, rawArgs?.onEvent, `${label} -> CANCELLED -> before send decision`);
          await closeLeadPage();
          executionRecord.ok = true;
          batchSummary.results.push(executionRecord);
          cancelRemainingRows(idx + 1);
          await saveJson(path.join(batchDir, "summary.json"), batchSummary);
          break;
        }

        if (sendLive && discoveredNewThread) {
          await persistThreadResolution({
            supabase,
            accountId,
            leadId: decision.lead_id,
            username: decision.username,
            threadUrl: liveThreadUrl,
            threadId: liveThreadId,
            discoveredAt: new Date().toISOString(),
            runDir: executionRecord.run_dir,
          });
          executionRecord.thread_url = liveThreadUrl;
          executionRecord.thread_resolution_state = "thread_resolution_succeeded";
        }

        if (!SAFE_STATES.has(classificationState)) {
          executionRecord.execution_state = "blocked_live_recheck";
          executionRecord.error_reason = `Live recheck returned ${classificationState || "unknown_state"}.`;
          emitLog(
            logs,
            rawArgs?.onEvent,
            `${label} -> BLOCKED -> live_state=${classificationState || "unknown"} action=${recommendedAction || "unknown"}`
          );
          if (sendLive) {
            await persistExecutionResult({
              supabase,
              accountId,
              leadId: decision.lead_id,
              username: decision.username,
              threadUrl: liveThreadUrl || decision.thread_url,
              runDir: executionRecord.run_dir,
              executionState: executionRecord.execution_state,
              followupNumber: decision.next_followup_number,
              messageText: decision.followup_message,
              classificationState,
              recommendedAction,
              errorMessage: executionRecord.error_reason,
              sendSucceeded: false,
            });
          }
          await closeLeadPage();
          executionRecord.ok = true;
        } else if (!executionRecord.initial_outreach_anchor_match) {
          executionRecord.execution_state = "blocked_initial_template_guard";
          executionRecord.error_reason =
            'No loaded outbound message matched the required initial outreach anchor phrase "full version?".';
          emitLog(
            logs,
            rawArgs?.onEvent,
            `${label} -> BLOCKED -> initial outreach anchor phrase not found in loaded outbound messages`
          );
          if (sendLive) {
            await persistExecutionResult({
              supabase,
              accountId,
              leadId: decision.lead_id,
              username: decision.username,
              threadUrl: liveThreadUrl || decision.thread_url,
              runDir: executionRecord.run_dir,
              executionState: executionRecord.execution_state,
              followupNumber: decision.next_followup_number,
              messageText: decision.followup_message,
              classificationState,
              recommendedAction,
              errorMessage: executionRecord.error_reason,
              sendSucceeded: false,
            });
          }
          await closeLeadPage();
          executionRecord.ok = true;
        } else if (!sendLive) {
          chosenFollowup = pickFollowupMessageVariant(decision.next_followup_number);
          executionRecord.selected_followup_message = s(chosenFollowup.message);
          executionRecord.selected_followup_variant_index = chosenFollowup.variant_index;
          executionRecord.execution_state = "dry_run_ready";
          emitLog(
            logs,
            rawArgs?.onEvent,
            `${label} -> DRY RUN READY -> action=${decision.next_action} live_state=${classificationState} anchor_match=yes variant=${chosenFollowup.variant_index || "n/a"}/${chosenFollowup.variant_count || 0}`
          );
          await closeLeadPage();
          executionRecord.ok = true;
        } else {
          chosenFollowup = pickFollowupMessageVariant(decision.next_followup_number);
          executionRecord.selected_followup_message = s(chosenFollowup.message);
          executionRecord.selected_followup_variant_index = chosenFollowup.variant_index;
          if (!chosenFollowup.message) {
            throw new Error(
              `No follow-up message variant configured for follow-up ${decision.next_followup_number}.`
            );
          }
          if (isCancelled()) {
            executionRecord.execution_state = "cancelled_by_user";
            executionRecord.error_reason = "Cancellation requested before send.";
            emitLog(logs, rawArgs?.onEvent, `${label} -> CANCELLED -> before send`);
            await closeLeadPage();
            executionRecord.ok = true;
            batchSummary.results.push(executionRecord);
            cancelRemainingRows(idx + 1);
            await saveJson(path.join(batchDir, "summary.json"), batchSummary);
            break;
          }

          const idleSummary = await runHumanizedThreadIdle({
            page,
            idleConfig: liveHumanization.idle,
            shouldCancel: isCancelled,
          });
          executionRecord.humanization.idle = idleSummary;
          if (idleSummary?.cancelled) {
            executionRecord.execution_state = "cancelled_by_user";
            executionRecord.error_reason = "Cancellation requested during pre-compose idle behavior.";
            emitLog(logs, rawArgs?.onEvent, `${label} -> CANCELLED -> during pre-compose idle`);
            await closeLeadPage();
            executionRecord.ok = true;
            batchSummary.results.push(executionRecord);
            cancelRemainingRows(idx + 1);
            await saveJson(path.join(batchDir, "summary.json"), batchSummary);
            break;
          }

          const longPauseSummary = sampleOptionalDelay(liveHumanization.longPause);
          executionRecord.humanization.long_pause = longPauseSummary;
          if (longPauseSummary.fired && longPauseSummary.delay_ms > 0) {
            emitLog(
              logs,
              rawArgs?.onEvent,
              `${label} -> humanization long pause ${longPauseSummary.delay_ms}ms after classification`
            );
            const cancelledDuringLongPause = await sleepWithCancel(longPauseSummary.delay_ms, isCancelled);
            if (cancelledDuringLongPause) {
              executionRecord.execution_state = "cancelled_by_user";
              executionRecord.error_reason = "Cancellation requested during long pre-send pause.";
              emitLog(logs, rawArgs?.onEvent, `${label} -> CANCELLED -> during long pre-send pause`);
              await closeLeadPage();
              executionRecord.ok = true;
              batchSummary.results.push(executionRecord);
              cancelRemainingRows(idx + 1);
              await saveJson(path.join(batchDir, "summary.json"), batchSummary);
              break;
            }
          }

          const preSendDelaySample = sampleDelayWithTail(preSendDelay, liveHumanization.delayTails.preSend);
          const postSendDelaySample = sampleDelayWithTail(postSendDelay, liveHumanization.delayTails.postSend);
          executionRecord.humanization.pre_send_delay = preSendDelaySample;
          executionRecord.humanization.post_send_delay = postSendDelaySample;
          emitLog(
            logs,
            rawArgs?.onEvent,
            `${label} -> humanization idle=${idleSummary?.initial_pause_ms || 0}ms long_pause=${longPauseSummary?.delay_ms || 0}ms pre_send=${preSendDelaySample.total_ms}ms (tail=${preSendDelaySample.tail_extra_ms}ms) post_send=${postSendDelaySample.total_ms}ms (tail=${postSendDelaySample.tail_extra_ms}ms)`
          );
          const sendResult = await sendMessageInOpenThread({
            page,
            messageText: chosenFollowup.message,
            preSendDelayMs: preSendDelaySample.total_ms,
            postSendDelayMs: postSendDelaySample.total_ms,
            humanization: liveHumanization.typing,
            waitFn: (ms) => sleepWithCancel(ms, isCancelled),
          });
          sendWasCompleted = true;
          executionRecord.execution_state = "sent_followup";
          executionRecord.send_verification_method = s(sendResult?.verification_method);
          executionRecord.humanization.typing = sendResult?.typing || null;
          emitLog(
            logs,
            rawArgs?.onEvent,
            `${label} -> SENT -> followup=${decision.next_followup_number} variant=${chosenFollowup.variant_index || "n/a"}/${chosenFollowup.variant_count || 0} verify=${executionRecord.send_verification_method || "unknown"} typing_elapsed=${sendResult?.typing?.typing_elapsed_ms ?? 0}ms typing_mode=${sendResult?.typing?.mode || "unknown"} hesitations=${sendResult?.typing?.hesitation_count ?? 0} bursts=${sendResult?.typing?.quick_burst_count ?? 0}`
          );

          await persistExecutionResult({
            supabase,
            accountId,
            leadId: decision.lead_id,
            username: decision.username,
            threadUrl: liveThreadUrl || decision.thread_url,
            runDir: executionRecord.run_dir,
            executionState: executionRecord.execution_state,
            followupNumber: decision.next_followup_number,
            messageText: chosenFollowup.message,
            classificationState,
            recommendedAction,
            errorMessage: null,
            sendSucceeded: true,
          });

          await closeLeadPage();
          executionRecord.ok = true;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        executionRecord.error_reason = message;
        const resolutionFailureState = classifyResolutionFailure(message, hadStoredThread);
        const cancelledByUser = /Cancellation requested/i.test(message);

        if (cancelledByUser) {
          executionRecord.execution_state = "cancelled_by_user";
          executionRecord.ok = true;
          cancelBatchAfterRecord = true;
          emitLog(logs, rawArgs?.onEvent, `${label} -> CANCELLED -> ${message}`);
        } else if (sendLive && sendWasCompleted) {
          executionRecord.execution_state = "sent_followup";
          emitLog(logs, rawArgs?.onEvent, `${label} -> SENT WITH PERSIST RETRY -> ${message}`);
          await persistExecutionResult({
            supabase,
            accountId,
            leadId: decision.lead_id,
            username: decision.username,
            threadUrl: executionRecord.thread_url || decision.thread_url,
            runDir: executionRecord.run_dir,
            executionState: "sent_followup",
            followupNumber: decision.next_followup_number,
            messageText: chosenFollowup.message || decision.followup_message,
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
        } else if (sendLive) {
          executionRecord.execution_state = resolutionFailureState || "send_failed";
          emitLog(logs, rawArgs?.onEvent, `${label} -> FAIL -> ${message}`);
          await persistExecutionResult({
            supabase,
            accountId,
            leadId: decision.lead_id,
            username: decision.username,
            threadUrl: executionRecord.thread_url || decision.thread_url,
            runDir: executionRecord.run_dir,
            executionState: executionRecord.execution_state,
            followupNumber: decision.next_followup_number,
            messageText: chosenFollowup.message || decision.followup_message,
            classificationState: executionRecord.live_classification_state,
            recommendedAction: executionRecord.live_recommended_action,
            errorMessage: message,
            sendSucceeded: false,
          }).catch((persistError) => {
            const persistMessage =
              persistError instanceof Error ? persistError.message : String(persistError);
            executionRecord.error_reason = `${message} | persist_error=${persistMessage}`;
          });
        } else {
          executionRecord.execution_state = resolutionFailureState || "dry_run_failed";
          emitLog(logs, rawArgs?.onEvent, `${label} -> FAIL -> ${message}`);
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
        executionRecord.execution_state === "dry_run_failed" ||
        executionRecord.execution_state === "thread_resolution_failed_search" ||
        executionRecord.execution_state === "thread_resolution_failed_verification"
      ) {
        consecutiveFailureCount += 1;
      } else {
        consecutiveFailureCount = 0;
      }

      if (
        sharedMissingThreadPage &&
        shouldUseSharedMissingThreadPage &&
        THREAD_RESOLUTION_FAILURE_STATES.has(String(executionRecord.execution_state || ""))
      ) {
        await gotoInbox(sharedMissingThreadPage).catch(async () => {
          await sharedMissingThreadPage?.close().catch(() => {});
          sharedMissingThreadPage = null;
        });
      }

      if (executionRecord.run_dir) {
        const runDirAbs = path.resolve(REPO_ROOT, executionRecord.run_dir);
        await saveJson(path.join(runDirAbs, "execution_result.json"), executionRecord).catch(() => {});
      }

      updateResolverFailureWindow(recentResolverAttempts, {
        attemptedResolution: !hadStoredThread,
        resolutionFailed: THREAD_RESOLUTION_FAILURE_STATES.has(
          String(executionRecord.execution_state || "")
        ),
      });
      postRecordAbort =
        (sendLive
          ? detectImmediateFrictionStop({
              executionRecord,
              errorReason: executionRecord.error_reason,
            })
          : null) || detectResolverFailureSpike(recentResolverAttempts);

      batchSummary.results.push(executionRecord);
      await saveJson(path.join(batchDir, "summary.json"), batchSummary);
      if (typeof rawArgs?.onEvent === "function") {
        rawArgs.onEvent({ type: "result", executionRecord, batchSummary });
      }

      if (postRecordAbort) {
        batchSummary.aborted_reason = postRecordAbort.reason;
        batchSummary.not_attempted_rows = selected.slice(idx + 1).map(({ decision: remainingDecision }) => ({
          lead_id: remainingDecision.lead_id,
          username: remainingDecision.username,
          reason: postRecordAbort.reason,
        }));
        emitLog(
          logs,
          rawArgs?.onEvent,
          `Stopping batch after item ${idx + 1}: ${postRecordAbort.reason} -> ${postRecordAbort.detail}`
        );
        await saveJson(path.join(batchDir, "summary.json"), batchSummary);
        break;
      }

      if (cancelBatchAfterRecord) {
        cancelRemainingRows(idx + 1);
        emitLog(logs, rawArgs?.onEvent, `Stopping batch after item ${idx + 1}: cancellation requested.`);
        break;
      }

      if (idx < selected.length - 1) {
        const interLeadDelaySample = sendLive
          ? sampleDelayWithTail(interLeadDelay, liveHumanization.delayTails.interLead)
          : { base_ms: randomIntBetween(interLeadDelay.min, interLeadDelay.max), tail_extra_ms: 0, total_ms: 0 };
        if (!sendLive) {
          interLeadDelaySample.total_ms = interLeadDelaySample.base_ms;
        }
        executionRecord.humanization.inter_lead_delay = interLeadDelaySample;
        emitLog(
          logs,
          rawArgs?.onEvent,
          `${label} -> cooling down ${interLeadDelaySample.total_ms}ms before next lead${sendLive ? ` (tail=${interLeadDelaySample.tail_extra_ms}ms)` : ""}`
        );
        const cancelledDuringCooldown = await sleepWithCancel(interLeadDelaySample.total_ms, isCancelled);
        if (cancelledDuringCooldown) {
          cancelRemainingRows(idx + 1);
          emitLog(logs, rawArgs?.onEvent, `Stopping batch after item ${idx + 1}: cancellation requested during cooldown.`);
          break;
        }
      }
    }
  } finally {
    if (sharedMissingThreadPage) {
      await sharedMissingThreadPage.close().catch(() => {});
    }
    await browser.close().catch(() => {});
  }

  await saveJson(path.join(batchDir, "summary.json"), batchSummary);
  return {
    ok: true,
    batch_id: batchId,
    batch_dir: path.relative(REPO_ROOT, batchDir),
    summary_path: path.relative(REPO_ROOT, path.join(batchDir, "summary.json")),
    summary: batchSummary,
    logs,
  };
}
