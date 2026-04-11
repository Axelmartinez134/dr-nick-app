import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

export const DEFAULT_DEBUGGER_URL = "http://127.0.0.1:9222";
export const INSTAGRAM_INBOX_URL = "https://www.instagram.com/direct/inbox/";
export const NETWORK_WAIT_MS = 6000;

export function normalizeUsername(value) {
  return String(value || "").trim().replace(/^@+/, "").toLowerCase();
}

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function buildRunFolderName({ username, leadId, runLabel }) {
  const parts = [timestampSlug()];
  if (username) parts.push(slugify(username));
  if (leadId) parts.push(String(leadId).slice(0, 8));
  if (runLabel) parts.push(slugify(runLabel));
  return parts.filter(Boolean).join("-");
}

export function deriveThreadIdFromUrl(url) {
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

export async function loadLocalEnvFiles(repoRoot) {
  const candidates = [".env.local", ".env"];
  for (const name of candidates) {
    const filePath = path.join(repoRoot, name);
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
      // Ignore missing env files.
    }
  }
}

export function getSupabaseAdminClient() {
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

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function saveJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

export async function appendJsonLine(filePath, value) {
  await fs.appendFile(filePath, `${JSON.stringify(value)}\n`, "utf-8");
}

export async function saveScreenshot(page, filePath) {
  await page.screenshot({ path: filePath, fullPage: true });
}

export async function loadLeads(leadsPath) {
  const raw = await fs.readFile(leadsPath, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected ${leadsPath} to contain a JSON array.`);
  }

  const leads = parsed
    .map((row) => ({
      id: String(row?.id || "").trim(),
      username: normalizeUsername(row?.username),
      fullName: typeof row?.full_name === "string" ? row.full_name.trim() : null,
      instagramUrl: typeof row?.instagram_url === "string" ? row.instagram_url.trim() : null,
    }))
    .filter((row) => row.id && row.username);

  if (!leads.length) {
    throw new Error(`No valid leads found in ${leadsPath}.`);
  }

  return leads;
}

export function pickLead(leads, args) {
  if (args.leadId) {
    const match = leads.find((lead) => lead.id === args.leadId);
    if (!match) {
      throw new Error(`No lead matched --lead-id ${args.leadId}`);
    }
    return match;
  }

  if (args.username) {
    const match = leads.find((lead) => lead.username === args.username);
    if (match) return match;
    return null;
  }

  return leads[0];
}

export async function loadLeadRowByUsername({ supabase, accountId, username }) {
  const uname = normalizeUsername(username);
  const unameAt = `@${uname}`;
  const { data, error } = await supabase
    .from("editor_outreach_targets")
    .select(
      [
        "id",
        "account_id",
        "username",
        "prospect_username",
        "full_name",
        "prospect_full_name",
        "instagram_dm_thread_url",
        "instagram_dm_thread_id",
        "instagram_dm_thread_discovered_at",
        "created_at",
      ].join(",")
    )
    .eq("account_id", accountId)
    .or(
      [
        `prospect_username.eq.${uname}`,
        `username.eq.${uname}`,
        `prospect_username.eq.${unameAt}`,
        `username.eq.${unameAt}`,
        `prospect_username.ilike.${uname}`,
        `username.ilike.${uname}`,
        `prospect_username.ilike.${unameAt}`,
        `username.ilike.${unameAt}`,
      ].join(",")
    )
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed loading outreach lead by username: ${error.message}`);
  }

  return Array.isArray(data) && data.length ? data[0] : null;
}

export async function loadLeadRowsFromDb({ supabase, accountId, ids }) {
  const uniqueIds = Array.from(new Set(ids.map((id) => String(id || "").trim()).filter(Boolean)));
  const { data, error } = await supabase
    .from("editor_outreach_targets")
    .select(
      [
        "id",
        "account_id",
        "username",
        "prospect_username",
        "full_name",
        "prospect_full_name",
        "instagram_dm_thread_url",
        "instagram_dm_thread_id",
        "instagram_dm_thread_discovered_at",
      ].join(",")
    )
    .eq("account_id", accountId)
    .in("id", uniqueIds);

  if (error) {
    throw new Error(`Failed loading outreach leads: ${error.message}`);
  }

  const byId = new Map();
  for (const row of Array.isArray(data) ? data : []) {
    byId.set(String(row?.id || "").trim(), row);
  }
  return byId;
}

export async function connectToBrowser(debuggerUrl) {
  return chromium.connectOverCDP(debuggerUrl);
}

export async function getFreshPage(browser) {
  const contexts = browser.contexts();
  if (!contexts.length) {
    throw new Error("No browser contexts were available after connecting to Chrome.");
  }

  const context = contexts[0];
  const page = await context.newPage();
  return { context, page };
}

export async function dismissCommonInstagramPrompts(page) {
  const maybeDismiss = async (label) => {
    const candidate = page.getByRole("button", { name: label }).first();
    if (await candidate.count()) {
      try {
        if (await candidate.isVisible({ timeout: 500 })) {
          await candidate.click({ timeout: 1000 });
          await page.waitForTimeout(500);
        }
      } catch {
        // Ignore already-dismissed prompts.
      }
    }
  };

  await maybeDismiss("Not Now");
  await maybeDismiss("Cancel");
}

export async function gotoInbox(page) {
  await page.goto(INSTAGRAM_INBOX_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await dismissCommonInstagramPrompts(page);
}

async function locateSearchInput(page, timeoutMs = 2000) {
  const candidates = [
    page.getByPlaceholder("Search").first(),
    page.getByRole("textbox", { name: /search/i }).first(),
    page.locator('input[placeholder="Search"]').first(),
    page.locator('input[aria-label="Search"]').first(),
    page.locator('input[type="text"]').first(),
  ];

  for (const locator of candidates) {
    try {
      await locator.waitFor({ state: "visible", timeout: timeoutMs });
      return locator;
    } catch {
      // Try next locator.
    }
  }

  throw new Error("Could not find the inbox search input.");
}

async function tryLocateSearchInput(page, timeoutMs = 1200) {
  try {
    return await locateSearchInput(page, timeoutMs);
  } catch {
    return null;
  }
}

function isInstagramDirectSurface(url) {
  return /instagram\.com\/direct(\/|$)/i.test(String(url || ""));
}

async function ensureInboxSearchReady(page, options = {}) {
  const preferCurrentSurface = !!options?.preferCurrentSurface;
  await dismissCommonInstagramPrompts(page);

  if (preferCurrentSurface && isInstagramDirectSurface(page.url())) {
    const existingInput = await tryLocateSearchInput(page, 1200);
    if (existingInput) {
      return {
        searchInput: existingInput,
        reused_surface: true,
        navigated_to_inbox: false,
      };
    }
  }

  await gotoInbox(page);
  const searchInput = await locateSearchInput(page, 2500);
  return {
    searchInput,
    reused_surface: false,
    navigated_to_inbox: true,
  };
}

async function clearTextLocator(locator) {
  const role = await locator.getAttribute("role").catch(() => null);
  const contentEditable = await locator.getAttribute("contenteditable").catch(() => null);
  const tagName = await locator.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");

  await locator.click().catch(() => {});
  if (tagName === "textarea" || tagName === "input") {
    await locator.fill("");
    return;
  }

  if (contentEditable === "true" || role === "textbox") {
    await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
    await locator.press("Backspace").catch(() => {});
    return;
  }

  await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
  await locator.press("Backspace").catch(() => {});
}

async function resetInboxSearch(page, searchInput, waitFn = null) {
  await clearTextLocator(searchInput);
  const clearedValue = String(await readComposerValue(searchInput).catch(() => "")).trim();
  if (clearedValue) {
    await searchInput.fill("").catch(() => {});
  }
  await waitWithStrategy(page, 450, waitFn);
  return {
    cleared: true,
  };
}

function sampleOptionalDelayRange(range = null) {
  const min = clampHumanizedInt(range?.minMs, 0, 0);
  const max = clampHumanizedInt(range?.maxMs, min, min);
  if (max <= 0) return 0;
  return randomIntBetweenInclusive(min, max);
}

async function typeIntoTextLocator({
  page,
  locator,
  text,
  plan,
  waitFn,
  fallbackMethod = "fill",
}) {
  const role = await locator.getAttribute("role").catch(() => null);
  const contentEditable = await locator.getAttribute("contenteditable").catch(() => null);
  const tagName = await locator.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");

  await locator.click();
  if (tagName === "textarea" || tagName === "input") {
    await locator.fill("");
  } else {
    await clearComposer(locator);
  }
  await locator.focus().catch(() => {});

  if (!plan?.enabled) {
    if (tagName === "textarea" || tagName === "input") {
      await locator.fill(text);
    } else if (contentEditable === "true" || role === "textbox") {
      await page.keyboard.insertText(text);
    } else {
      await locator.fill(text);
    }
    return {
      mode: "instant",
      typing_budget_ms: 0,
      typing_elapsed_ms: 0,
      chunk_count: 1,
      chunk_sizes: [text.length],
      hesitation_count: 0,
      quick_burst_count: 0,
    };
  }

  const chunks = Array.isArray(plan?.chunks) ? plan.chunks : [text];
  const delays = Array.isArray(plan?.delays) ? plan.delays : [];
  const chunkSizes = [];
  for (let idx = 0; idx < chunks.length; idx += 1) {
    const chunk = String(chunks[idx] || "");
    if (!chunk) continue;
    await page.keyboard.insertText(chunk);
    chunkSizes.push(chunk.length);
    if (idx < delays.length) {
      const cancelled = await waitWithStrategy(page, delays[idx], waitFn);
      if (cancelled) {
        throw new Error("Cancellation requested during humanized typing.");
      }
    }
  }

  const typedValue = String(await readComposerValue(locator).catch(() => ""));
  if (typedValue !== text) {
    if (tagName === "textarea" || tagName === "input" || fallbackMethod === "fill") {
      await locator.fill(text);
      return {
        mode: "chunked_fallback_to_exact_fill",
        typing_budget_ms: plan?.typing_budget_ms || 0,
        typing_elapsed_ms: plan?.typing_elapsed_ms || 0,
        chunk_count: chunks.length,
        chunk_sizes: chunkSizes,
        hesitation_count: plan?.hesitation_count || 0,
        quick_burst_count: plan?.quick_burst_count || 0,
        fallback_reason: "typed_value_mismatch",
      };
    }
    await clearComposer(locator);
    await locator.focus().catch(() => {});
    await page.keyboard.insertText(text);
    return {
      mode: "chunked_fallback_to_exact_insert",
      typing_budget_ms: plan?.typing_budget_ms || 0,
      typing_elapsed_ms: plan?.typing_elapsed_ms || 0,
      chunk_count: chunks.length,
      chunk_sizes: chunkSizes,
      hesitation_count: plan?.hesitation_count || 0,
      quick_burst_count: plan?.quick_burst_count || 0,
      fallback_reason: "typed_value_mismatch",
    };
  }

  return {
    mode: "chunked",
    typing_budget_ms: plan?.typing_budget_ms || 0,
    typing_elapsed_ms: plan?.typing_elapsed_ms || 0,
    chunk_count: chunks.length,
    chunk_sizes: chunkSizes,
    hesitation_count: plan?.hesitation_count || 0,
    quick_burst_count: plan?.quick_burst_count || 0,
  };
}

async function findResultLocator(page, username) {
  const exactProfileHref = page.locator(`a[href="/${username}/"]`).first();
  if (await exactProfileHref.count()) return exactProfileHref;

  const textMatch = page.getByText(new RegExp(`^@?${username}$`, "i")).first();
  if (await textMatch.count()) return textMatch;

  const fuzzyText = page
    .getByText(new RegExp(username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
    .first();
  if (await fuzzyText.count()) return fuzzyText;

  return null;
}

export async function searchAndOpenThread(page, username, options = {}) {
  const inboxReady = await ensureInboxSearchReady(page, {
    preferCurrentSurface: !!options?.preferCurrentSurface,
  });
  const searchInput = inboxReady.searchInput;
  const searchHumanization = options?.humanization || null;
  const waitFn = typeof options?.waitFn === "function" ? options.waitFn : null;
  const preFocusPauseMs = searchHumanization?.enabled
    ? sampleOptionalDelayRange(searchHumanization.preFocusPauseMs)
    : 300;
  const postTypeSettleMs = searchHumanization?.enabled
    ? sampleOptionalDelayRange(searchHumanization.postTypeSettleMs)
    : 2500;

  const cancelledBeforeFocus = await waitWithStrategy(page, preFocusPauseMs, waitFn);
  if (cancelledBeforeFocus) {
    throw new Error("Cancellation requested during search pre-focus delay.");
  }

  const resetResult = await resetInboxSearch(page, searchInput, waitFn);

  const typingPlan = buildHumanizedTypingPlan(username, searchHumanization || {});
  const typingResult = await typeIntoTextLocator({
    page,
    locator: searchInput,
    text: username,
    plan: typingPlan,
    waitFn,
    fallbackMethod: "fill",
  });

  const settledValue = String(await readComposerValue(searchInput).catch(() => "")).trim();
  if (settledValue !== username) {
    await searchInput.fill(username);
  }

  const cancelledAfterType = await waitWithStrategy(page, postTypeSettleMs, waitFn);
  if (cancelledAfterType) {
    throw new Error("Cancellation requested during search post-type settle.");
  }

  const resultLocator = await findResultLocator(page, username);
  if (!resultLocator) {
    throw new Error("No matching inbox result was found.");
  }

  let beforeOpenResult = null;
  if (typeof options?.onBeforeOpen === "function") {
    beforeOpenResult = await options.onBeforeOpen({
      page,
      username,
      resultLocator,
      searchInput,
    });
  }

  await resultLocator.click({ timeout: 5000 });
  await page.waitForURL(/\/direct\/t\/.+/, { timeout: 10000 });
  await page.waitForTimeout(1500);
  return {
    before_open_result: beforeOpenResult,
    inbox_surface: {
      reused_surface: inboxReady.reused_surface,
      navigated_to_inbox: inboxReady.navigated_to_inbox,
      reset: resetResult,
    },
    humanization: searchHumanization?.enabled
      ? {
          enabled: true,
          pre_focus_pause_ms: preFocusPauseMs,
          post_type_settle_ms: postTypeSettleMs,
          typing: typingResult,
        }
      : {
          enabled: false,
          pre_focus_pause_ms: preFocusPauseMs,
          post_type_settle_ms: postTypeSettleMs,
          typing: typingResult,
        },
  };
}

export async function openStoredThread(page, threadUrl) {
  await page.goto(threadUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await dismissCommonInstagramPrompts(page);
  await page.waitForTimeout(1500);

  if (!page.url().includes("/direct/t/")) {
    throw new Error("Stored thread URL did not resolve to a /direct/t/ page.");
  }
}

export async function verifyThreadOwner(page, username) {
  const profileLink = page.locator(`header a[href="/${username}/"]`).first();
  if (await profileLink.count()) {
    try {
      await profileLink.waitFor({ state: "visible", timeout: 2500 });
      return true;
    } catch {
      // Fall through to text check.
    }
  }

  const textLocator = page
    .getByText(new RegExp(username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
    .first();
  if (await textLocator.count()) {
    try {
      await textLocator.waitFor({ state: "visible", timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

function isInterestingInstagramUrl(url) {
  const raw = String(url || "");
  return (
    raw.includes("instagram.com") &&
    /direct|direct_v2|graphql|thread|inbox/i.test(raw)
  );
}

function scanForCandidateFields(value, out = {}) {
  const targetKeys = new Set([
    "thread_id",
    "items",
    "viewer_id",
    "last_seen_at",
    "read_state",
    "unseen_count",
    "users",
    "messages",
  ]);

  const visit = (node) => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      if (targetKeys.has(key)) out[key] = true;
      visit(child);
    }
  };

  visit(value);
  return out;
}

export async function createNetworkCapture(page, payloadsDir, slugBase) {
  const captures = [];
  const pending = [];
  let counter = 0;

  const handleResponse = (response) => {
    const task = (async () => {
      const url = response.url();
      if (!isInterestingInstagramUrl(url)) return;

      const headers = await response.allHeaders().catch(() => ({}));
      const contentType = String(headers["content-type"] || headers["Content-Type"] || "").toLowerCase();
      const status = response.status();

      let bodyText = "";
      try {
        bodyText = await response.text();
      } catch {
        return;
      }

      if (!bodyText.trim()) return;

      let parsedJson = null;
      try {
        parsedJson = JSON.parse(bodyText);
      } catch {
        // Not JSON; still save if the URL is interesting.
      }

      const fieldFlags = scanForCandidateFields(parsedJson || {});
      const hasInterestingFields = Object.keys(fieldFlags).length > 0;
      const looksThreadRelated =
        hasInterestingFields ||
        /thread_id|last_seen_at|read_state|viewer_id|unseen_count|direct_v2|inbox/i.test(bodyText);

      if (!looksThreadRelated) return;

      counter += 1;
      const fileName = `${slugBase}-${String(counter).padStart(2, "0")}.json`;
      const filePath = path.join(payloadsDir, fileName);
      const payloadDoc = {
        captured_at: new Date().toISOString(),
        url,
        status,
        content_type: contentType || null,
        candidate_fields_found: fieldFlags,
        root_keys:
          parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson)
            ? Object.keys(parsedJson).slice(0, 50)
            : [],
        body: parsedJson ?? bodyText,
      };

      await fs.writeFile(filePath, `${JSON.stringify(payloadDoc, null, 2)}\n`, "utf-8");
      captures.push({
        url,
        status,
        content_type: contentType || null,
        file_path: filePath,
        relative_file_path: fileName,
        candidate_fields_found: fieldFlags,
        root_keys: payloadDoc.root_keys,
      });
    })();

    pending.push(task);
  };

  page.on("response", handleResponse);

  return {
    async stop() {
      page.off("response", handleResponse);
      await Promise.allSettled(pending);
      return captures;
    },
  };
}

export function summarizeCaptures(captures, projectRoot = process.cwd()) {
  const aggregate = {};
  for (const capture of captures) {
    for (const key of Object.keys(capture.candidate_fields_found || {})) {
      aggregate[key] = true;
    }
  }

  return {
    matched_response_count: captures.length,
    matched_urls: captures.map((item) => item.url),
    saved_payload_paths: captures.map((item) => path.relative(projectRoot, item.file_path)),
    candidate_fields_found: aggregate,
    capture_summaries: captures.map((item) => ({
      url: item.url,
      status: item.status,
      content_type: item.content_type,
      file_path: path.relative(projectRoot, item.file_path),
      candidate_fields_found: item.candidate_fields_found,
      root_keys: item.root_keys,
    })),
  };
}

export async function enableFreshNetworkCapture(page) {
  try {
    const context = page.context();
    const session = await context.newCDPSession(page);
    await session.send("Network.enable");
    await session.send("Network.setCacheDisabled", { cacheDisabled: true });
    return true;
  } catch {
    return false;
  }
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

function getCanonicalThread(payloadDoc) {
  return payloadDoc?.body?.data?.get_slide_thread_nullable?.as_ig_direct_thread || null;
}

function matchesExpectedThread({ thread, expectedThreadToken, expectedUsername }) {
  if (!thread) return false;

  const threadKey = String(thread?.thread_key || "").trim();
  const participantUsernames = Array.isArray(thread?.users)
    ? thread.users.map((user) => normalizeUsername(user?.username)).filter(Boolean)
    : [];

  if (expectedThreadToken && threadKey === expectedThreadToken) {
    return true;
  }

  if (expectedUsername && participantUsernames.includes(expectedUsername)) {
    return true;
  }

  return false;
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
  for (const filePath of filePaths) {
    try {
      const doc = await readJson(filePath);
      docs.push({
        absolutePath: filePath,
        payloadDoc: doc,
        score: scorePayloadDoc(doc),
      });
    } catch (error) {
      docs.push({
        absolutePath: filePath,
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

export async function analyzeCaptureResult(captureResult, projectRoot = process.cwd()) {
  const payloadPaths = Array.isArray(captureResult?.saved_payload_paths)
    ? captureResult.saved_payload_paths.map((value) => path.resolve(projectRoot, value))
    : [];
  const expectedThreadToken = deriveThreadIdFromUrl(captureResult?.thread_url);
  const expectedUsername = normalizeUsername(captureResult?.username);

  if (!payloadPaths.length) {
    throw new Error("The capture result did not contain any saved payload paths.");
  }

  const docs = await loadPayloadDocs(payloadPaths);
  const rankedDocs = docs
    .filter((doc) => doc.payloadDoc && doc.score >= 0)
    .filter((doc) =>
      matchesExpectedThread({
        thread: getCanonicalThread(doc.payloadDoc),
        expectedThreadToken,
        expectedUsername,
      })
    )
    .sort((a, b) => b.score - a.score);

  if (!rankedDocs.length) {
    throw new Error(
      `No captured payload matched the expected thread target (${expectedThreadToken || expectedUsername || "unknown"}).`
    );
  }

  const bestDoc = rankedDocs[0];
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
    lead_id: captureResult?.lead_id || null,
    username: normalizeUsername(captureResult?.username) || null,
    thread_url: captureResult?.thread_url || null,
    selected_payload_path: path.relative(projectRoot, bestDoc.absolutePath),
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
    loaded_messages: normalizedMessages,
    outbound_loaded_messages: outboundMessages,
    inbound_loaded_messages: inboundMessages,
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

function uniqueStrings(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function classifyAnalysisRow(row) {
  const participantInteropFbids = uniqueStrings(row?.participant_interop_fbids);
  const readReceipts = Array.isArray(row?.read_receipts) ? row.read_receipts : [];
  const receiptFbids = uniqueStrings(readReceipts.map((receipt) => receipt?.participant_fbid));
  const viewerInteropFbid = hasValue(row?.viewer_interop_fbid)
    ? String(row.viewer_interop_fbid).trim()
    : null;

  const result = {
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

  const hasInbound = result.loaded_inbound_message_count > 0;
  const latestFromViewer = result.latest_loaded_message_from_viewer;
  const hasParticipantReceipt = result.matched_participant_receipt_found;
  const hasViewerReceipt =
    !!viewerInteropFbid && result.receipt_participant_fbids.includes(viewerInteropFbid);

  if (!hasValue(row?.selected_payload_path)) result.reason_codes.push("missing_selected_payload_path");
  if (!hasValue(row?.thread_id)) result.reason_codes.push("missing_thread_id");
  if (!viewerInteropFbid) result.reason_codes.push("missing_viewer_interop_fbid");
  if (!participantInteropFbids.length) result.reason_codes.push("missing_participant_interop_fbids");
  if (!row?.latest_loaded_message) result.reason_codes.push("missing_latest_loaded_message");
  if (!readReceipts.length) result.reason_codes.push("missing_read_receipts");

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

  result.reason_codes.push("receipt_pattern_unresolved");
  return result;
}

async function executeResolvedLeadNetworkCheck({
  browser,
  outputDir,
  runIndexPath = null,
  leadId,
  username,
  row,
  threadUrlOverride = "",
  runLabel = "",
  stepLabel = "",
  projectRoot = process.cwd(),
  keepPageOpen = false,
  resolverHumanization = null,
  resolverWaitFn = null,
  providedPage = null,
  preferDirectCaptureAfterSearchOpen = false,
  fallbackReopenAfterSearchCaptureMiss = false,
}) {
  const runsDir = path.join(outputDir, "network_runs");
  await ensureDir(runsDir);

  const resolvedUsername = normalizeUsername(username);
  const resolvedLeadId = String(leadId || row?.id || "").trim();
  const storedThreadUrl = String(threadUrlOverride || row?.instagram_dm_thread_url || "").trim();
  const runFolderName = buildRunFolderName({
    username: resolvedUsername,
    leadId: resolvedLeadId,
    runLabel,
  });
  const runDir = path.join(runsDir, runFolderName);
  const payloadsDir = path.join(runDir, "network_payloads");
  const prefix = stepLabel || resolvedUsername || resolvedLeadId || "lead";

  await ensureDir(runDir);
  await ensureDir(payloadsDir);

  const captureResult = {
    lead_id: resolvedLeadId || null,
    username: resolvedUsername || null,
    success: false,
    thread_url: null,
    thread_id: null,
    verification_passed: false,
    resolution_source: null,
    stored_thread_url_before: storedThreadUrl || null,
    used_fallback: false,
    discovered_new_thread: false,
    capture_success: false,
    matched_response_count: 0,
    matched_urls: [],
    saved_payload_paths: [],
    candidate_fields_found: {},
    capture_summaries: [],
    error_reason: null,
    timestamp: new Date().toISOString(),
    screenshot_path: null,
    run_dir: path.relative(projectRoot, runDir),
    search_humanization: null,
    search_inbox_surface: null,
    first_open_capture_attempted: false,
    first_open_capture_succeeded: false,
    first_open_capture_error: null,
    reopen_fallback_used: false,
    capture_strategy: null,
  };

  const resultPath = path.join(runDir, "result.json");
  let analysisResult = null;
  let classificationResult = null;
  let capture = null;
  let allCaptures = [];

  const ownsPage = !providedPage;
  const page = providedPage || (await getFreshPage(browser)).page;

  async function waitAndStopCapture(reasonLabel) {
    if (!capture) return [];
    console.log(`${prefix} -> ${reasonLabel} -> waiting ${NETWORK_WAIT_MS}ms for matching responses`);
    await page.waitForTimeout(NETWORK_WAIT_MS);
    await page.waitForTimeout(1000);
    const captures = await capture.stop();
    capture = null;
    allCaptures = allCaptures.concat(captures);
    const captureSummary = summarizeCaptures(allCaptures, projectRoot);
    Object.assign(captureResult, captureSummary);
    captureResult.capture_success = allCaptures.length > 0;
    return captures;
  }

  try {
    const cacheDisabled = await enableFreshNetworkCapture(page);
    captureResult.cache_disabled = cacheDisabled;

    if (!row) {
      throw new Error("Lead target was not found for the supplied account_id.");
    }

    if (storedThreadUrl) {
      console.log(`${prefix} -> trying stored thread`);
      try {
        await openStoredThread(page, storedThreadUrl);
        captureResult.thread_url = page.url();
        captureResult.thread_id = deriveThreadIdFromUrl(captureResult.thread_url);
        captureResult.verification_passed = await verifyThreadOwner(page, resolvedUsername);

        if (!captureResult.verification_passed) {
          throw new Error("Stored thread opened but participant verification failed.");
        }

        captureResult.resolution_source = "stored";
      } catch (storedError) {
        captureResult.used_fallback = true;
        console.log(
          `${prefix} -> stored thread failed -> ${storedError instanceof Error ? storedError.message : String(storedError)}`
        );
      }
    } else {
      captureResult.used_fallback = true;
      console.log(`${prefix} -> no stored thread -> using fallback discovery`);
    }

    const slugBase = `capture-${slugify(resolvedUsername)}`;
    const shouldAttemptFirstOpenCapture =
      preferDirectCaptureAfterSearchOpen && !captureResult.resolution_source?.startsWith("stored");

    if (!captureResult.resolution_source) {
      const searchResult = await searchAndOpenThread(page, resolvedUsername, {
        humanization: resolverHumanization,
        waitFn: resolverWaitFn,
        preferCurrentSurface: !!providedPage,
        onBeforeOpen:
          shouldAttemptFirstOpenCapture
            ? async () => {
                capture = await createNetworkCapture(page, payloadsDir, `${slugBase}-first-open`);
                captureResult.first_open_capture_attempted = true;
                return { capture_started: true };
              }
            : null,
      });
      captureResult.search_humanization = searchResult?.humanization || null;
      captureResult.search_inbox_surface = searchResult?.inbox_surface || null;
      captureResult.thread_url = page.url();
      captureResult.thread_id = deriveThreadIdFromUrl(captureResult.thread_url);
      captureResult.verification_passed = await verifyThreadOwner(page, resolvedUsername);

      if (!captureResult.thread_url.includes("/direct/t/")) {
        throw new Error("Fallback discovery did not produce a /direct/t/ thread URL.");
      }

      if (!captureResult.verification_passed) {
        throw new Error("Fallback discovery opened a thread but participant verification failed.");
      }

      captureResult.resolution_source = storedThreadUrl ? "fallback_discovery" : "discovery_only";
      captureResult.discovered_new_thread = captureResult.thread_url !== storedThreadUrl;
    }

    if (captureResult.first_open_capture_attempted) {
      await waitAndStopCapture("first-open capture");
      try {
        analysisResult = await analyzeCaptureResult(captureResult, projectRoot);
        classificationResult = classifyAnalysisRow(analysisResult);
        captureResult.first_open_capture_succeeded = true;
        captureResult.capture_strategy = "first_open_only";
      } catch (error) {
        captureResult.first_open_capture_error =
          error instanceof Error ? error.message : String(error);
        if (!fallbackReopenAfterSearchCaptureMiss) {
          throw error;
        }
      }
    }

    if (!analysisResult || !classificationResult) {
      captureResult.reopen_fallback_used = captureResult.first_open_capture_attempted;
      captureResult.capture_strategy = captureResult.first_open_capture_attempted
        ? "first_open_fallback_reopen"
        : "reopen_only";
      capture = await createNetworkCapture(page, payloadsDir, `${slugBase}-reopen`);
      await openStoredThread(page, captureResult.thread_url);

      const postRefreshVerification = await verifyThreadOwner(page, resolvedUsername);
      if (!postRefreshVerification) {
        throw new Error("Target thread could not be re-verified after starting network capture.");
      }

      await waitAndStopCapture("reopen capture");
      analysisResult = await analyzeCaptureResult(captureResult, projectRoot);
      classificationResult = classifyAnalysisRow(analysisResult);
    }

    captureResult.success = true;

    const screenshotPath = path.join(runDir, "thread.png");
    await saveScreenshot(page, screenshotPath);
    captureResult.screenshot_path = path.relative(projectRoot, screenshotPath);

    await saveJson(path.join(runDir, "capture_result.json"), captureResult);

    await saveJson(path.join(runDir, "analysis_result.json"), analysisResult);

    await saveJson(path.join(runDir, "classification_result.json"), classificationResult);

    const combinedResult = {
      run_dir: captureResult.run_dir,
      capture_result: captureResult,
      analysis_result: analysisResult,
      classification_result: classificationResult,
    };
    await saveJson(resultPath, combinedResult);

    if (runIndexPath) {
      await appendJsonLine(runIndexPath, {
        run_dir: captureResult.run_dir,
        lead_id: captureResult.lead_id,
        username: captureResult.username,
        thread_url: captureResult.thread_url,
        resolution_source: captureResult.resolution_source,
        matched_response_count: captureResult.matched_response_count,
        classification_state: classificationResult.classification_state,
        recommended_action: classificationResult.recommended_action,
        confidence: classificationResult.confidence,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(
      `${prefix} -> ${classificationResult.classification_state} -> action=${classificationResult.recommended_action}`
    );

    return {
      ok: true,
      page,
      run_dir: captureResult.run_dir,
      capture_result: captureResult,
      analysis_result: analysisResult,
      classification_result: classificationResult,
    };
  } catch (error) {
    const captures = capture ? await capture.stop() : [];
    allCaptures = allCaptures.concat(captures);
    const captureSummary = summarizeCaptures(allCaptures, projectRoot);
    Object.assign(captureResult, captureSummary);
    captureResult.error_reason = error instanceof Error ? error.message : String(error);

    try {
      const screenshotPath = path.join(runDir, "thread-fail.png");
      await saveScreenshot(page, screenshotPath);
      captureResult.screenshot_path = path.relative(projectRoot, screenshotPath);
    } catch {
      // Ignore screenshot failures.
    }

    const combinedResult = {
      run_dir: captureResult.run_dir,
      capture_result: captureResult,
      analysis_result: analysisResult,
      classification_result: classificationResult,
    };
    await saveJson(path.join(runDir, "capture_result.json"), captureResult);
    await saveJson(resultPath, combinedResult);

    if (runIndexPath) {
      await appendJsonLine(runIndexPath, {
        run_dir: captureResult.run_dir,
        lead_id: captureResult.lead_id,
        username: captureResult.username,
        classification_state: "failed_pipeline_run",
        recommended_action: "human_review",
        confidence: "low",
        error_reason: captureResult.error_reason,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`${prefix} -> FAIL -> ${captureResult.error_reason}`);

    return {
      ok: false,
      page: null,
      run_dir: captureResult.run_dir,
      capture_result: captureResult,
      analysis_result: analysisResult,
      classification_result: classificationResult,
      error_reason: captureResult.error_reason,
    };
  } finally {
    if (ownsPage && (!keepPageOpen || !captureResult.success)) {
      await page.close().catch(() => {});
    }
  }
}

export async function runResolvedLeadNetworkPipeline(args) {
  const result = await executeResolvedLeadNetworkCheck({
    ...args,
    keepPageOpen: false,
  });

  return {
    ok: result.ok,
    run_dir: result.run_dir,
    capture_result: result.capture_result,
    analysis_result: result.analysis_result,
    classification_result: result.classification_result,
    error_reason: result.error_reason,
  };
}

export async function runResolvedLeadNetworkCheckWithPage(args) {
  return executeResolvedLeadNetworkCheck({
    ...args,
    keepPageOpen: true,
  });
}

async function firstVisibleFromLocator(locator) {
  const count = await locator.count().catch(() => 0);
  for (let idx = 0; idx < count; idx += 1) {
    const candidate = locator.nth(idx);
    const visible = await candidate.isVisible().catch(() => false);
    if (visible) {
      return candidate;
    }
  }
  return null;
}

async function locateThreadComposer(page) {
  const selectorGroups = [
    'div[contenteditable="true"][role="textbox"][aria-placeholder*="Message"]',
    '[contenteditable="true"][aria-placeholder*="Message"]',
    'textarea[placeholder*="Message"]',
    'input[placeholder*="Message"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'form [contenteditable="true"]',
    'form textarea',
    'form input[type="text"]',
  ];

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    for (const selector of selectorGroups) {
      const match = await firstVisibleFromLocator(page.locator(selector));
      if (match) {
        return match;
      }
    }
    await page.waitForTimeout(500);
  }

  throw new Error("Could not find the DM composer.");
}

async function clearComposer(locator) {
  const role = await locator.getAttribute("role").catch(() => null);
  const contentEditable = await locator.getAttribute("contenteditable").catch(() => null);
  const tagName = await locator.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");

  if (tagName === "textarea" || tagName === "input") {
    await locator.fill("");
    return;
  }

  if (contentEditable === "true" || role === "textbox") {
    await locator.click();
    await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
    await locator.press("Backspace").catch(() => {});
    return;
  }

  await locator.click();
  await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await locator.press("Backspace");
}

async function readComposerValue(locator) {
  return locator.evaluate((el) => {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      return el.value || "";
    }
    if (el instanceof HTMLElement) {
      return el.innerText || el.textContent || "";
    }
    return "";
  });
}

function clampHumanizedInt(value, fallback, min = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.floor(n));
}

function randomIntBetweenInclusive(minValue, maxValue) {
  const min = Math.floor(Math.min(minValue, maxValue));
  const max = Math.floor(Math.max(minValue, maxValue));
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomChance(probability) {
  const p = Number(probability);
  if (!Number.isFinite(p) || p <= 0) return false;
  if (p >= 1) return true;
  return Math.random() < p;
}

function buildHumanizedTypingPlan(text, options = {}) {
  const enabled = !!options?.enabled;
  if (!enabled) {
    return {
      enabled: false,
      chunks: [text],
      delays: [],
      typing_budget_ms: 0,
      typing_elapsed_ms: 0,
      mode: "instant",
    };
  }

  const pauseMinMs = clampHumanizedInt(options?.pauseMinMs, 45, 0);
  const pauseMaxMs = clampHumanizedInt(options?.pauseMaxMs, 135, pauseMinMs);
  const spacePauseMinMs = clampHumanizedInt(options?.spacePauseMinMs, pauseMinMs, 0);
  const spacePauseMaxMs = clampHumanizedInt(options?.spacePauseMaxMs, pauseMaxMs, spacePauseMinMs);
  const punctuationPauseMinMs = clampHumanizedInt(options?.punctuationPauseMinMs, 120, 0);
  const punctuationPauseMaxMs = clampHumanizedInt(options?.punctuationPauseMaxMs, 260, punctuationPauseMinMs);
  const maxTypingBudgetMs = clampHumanizedInt(options?.maxTypingBudgetMs, 4200, 0);
  const minChunkSize = clampHumanizedInt(options?.minChunkSize, 2, 1);
  const preferredMaxChunkSize = clampHumanizedInt(options?.maxChunkSize, 7, minChunkSize);
  const hesitationChance = Number(options?.hesitationChance);
  const hesitationMinMs = clampHumanizedInt(options?.hesitationMinMs, 0, 0);
  const hesitationMaxMs = clampHumanizedInt(options?.hesitationMaxMs, hesitationMinMs, hesitationMinMs);
  const quickBurstChance = Number(options?.quickBurstChance);
  const quickBurstMultiplierMin = Math.max(0, Number(options?.quickBurstMultiplierMin) || 0.45);
  const quickBurstMultiplierMax = Math.max(
    quickBurstMultiplierMin,
    Number(options?.quickBurstMultiplierMax) || 0.8
  );
  const slowStartChars = clampHumanizedInt(options?.slowStartChars, 0, 0);
  const slowStartMultiplierMin = Math.max(1, Number(options?.slowStartMultiplierMin) || 1.15);
  const slowStartMultiplierMax = Math.max(
    slowStartMultiplierMin,
    Number(options?.slowStartMultiplierMax) || 1.75
  );
  const avgPauseMs = Math.max(1, Math.floor((pauseMinMs + pauseMaxMs) / 2));
  const maxPauseCountFromBudget = maxTypingBudgetMs > 0 ? Math.max(0, Math.floor(maxTypingBudgetMs / avgPauseMs)) : text.length;
  const maxChunkCountByBudget = Math.max(1, maxPauseCountFromBudget + 1);
  const minChunkCountBySize = Math.max(1, Math.ceil(text.length / Math.max(preferredMaxChunkSize, 1)));
  const maxChunkCountBySize = Math.max(1, Math.ceil(text.length / Math.max(minChunkSize, 1)));
  const chunkCount = Math.max(minChunkCountBySize, Math.min(maxChunkCountBySize, maxChunkCountByBudget));

  const chunks = [];
  let cursor = 0;
  for (let chunkIdx = 0; chunkIdx < chunkCount; chunkIdx += 1) {
    const remainingChars = text.length - cursor;
    const remainingChunks = chunkCount - chunkIdx;
    if (remainingChars <= 0) break;
    let targetSize = Math.ceil(remainingChars / remainingChunks);
    if (remainingChunks > 1) {
      const jitter = randomIntBetweenInclusive(-1, 2);
      targetSize += jitter;
    }
    targetSize = Math.max(1, Math.min(remainingChars, targetSize));
    if (remainingChunks > 1) {
      const maxAllowed = remainingChars - (remainingChunks - 1);
      targetSize = Math.min(targetSize, maxAllowed);
    }
    const chunk = text.slice(cursor, cursor + targetSize);
    chunks.push(chunk);
    cursor += targetSize;
  }
  if (cursor < text.length) {
    const remainder = text.slice(cursor);
    if (chunks.length) chunks[chunks.length - 1] += remainder;
    else chunks.push(remainder);
  }

  const delays = [];
  let totalDelayMs = 0;
  let hesitationCount = 0;
  let quickBurstCount = 0;
  for (let idx = 0; idx < Math.max(0, chunks.length - 1); idx += 1) {
    const chunk = chunks[idx] || "";
    const endsWithWhitespace = /\s$/.test(chunk);
    const trimmed = chunk.trimEnd();
    const endsWithPunctuation = /[.!?,:;]$/.test(trimmed);
    let delayMs = endsWithPunctuation
      ? randomIntBetweenInclusive(punctuationPauseMinMs, punctuationPauseMaxMs)
      : endsWithWhitespace
        ? randomIntBetweenInclusive(spacePauseMinMs, spacePauseMaxMs)
        : randomIntBetweenInclusive(pauseMinMs, pauseMaxMs);

    if (idx < slowStartChars) {
      const scale =
        slowStartMultiplierMin +
        Math.random() * Math.max(0, slowStartMultiplierMax - slowStartMultiplierMin);
      delayMs = Math.floor(delayMs * scale);
    }

    if (Number.isFinite(quickBurstChance) && quickBurstChance > 0 && randomChance(quickBurstChance)) {
      const burstScale =
        quickBurstMultiplierMin +
        Math.random() * Math.max(0, quickBurstMultiplierMax - quickBurstMultiplierMin);
      delayMs = Math.max(15, Math.floor(delayMs * burstScale));
      quickBurstCount += 1;
    }

    if (Number.isFinite(hesitationChance) && hesitationChance > 0 && randomChance(hesitationChance)) {
      delayMs += randomIntBetweenInclusive(hesitationMinMs, hesitationMaxMs);
      hesitationCount += 1;
    }

    delays.push(delayMs);
    totalDelayMs += delayMs;
  }

  if (maxTypingBudgetMs > 0 && totalDelayMs > maxTypingBudgetMs && delays.length > 0) {
    const scale = maxTypingBudgetMs / totalDelayMs;
    totalDelayMs = 0;
    for (let idx = 0; idx < delays.length; idx += 1) {
      const scaled = Math.max(0, Math.floor(delays[idx] * scale));
      delays[idx] = scaled;
      totalDelayMs += scaled;
    }
  }

  return {
    enabled: true,
    mode: "chunked",
    chunks,
    delays,
    typing_budget_ms: maxTypingBudgetMs,
    typing_elapsed_ms: totalDelayMs,
    chunk_count: chunks.length,
    hesitation_count: hesitationCount,
    quick_burst_count: quickBurstCount,
  };
}

async function waitWithStrategy(locatorPage, delayMs, waitFn) {
  const ms = clampHumanizedInt(delayMs, 0, 0);
  if (ms <= 0) return false;
  if (typeof waitFn === "function") {
    return !!(await waitFn(ms));
  }
  await locatorPage.waitForTimeout(ms);
  return false;
}

async function typeComposerHumanized({ page, composer, text, plan, waitFn }) {
  const role = await composer.getAttribute("role").catch(() => null);
  const contentEditable = await composer.getAttribute("contenteditable").catch(() => null);
  const tagName = await composer.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");

  await composer.click();
  await clearComposer(composer);
  await composer.focus().catch(() => {});

  if (!plan?.enabled) {
    if (tagName === "textarea" || tagName === "input") {
      await composer.fill(text);
    } else if (contentEditable === "true" || role === "textbox") {
      await page.keyboard.insertText(text);
    } else {
      await composer.fill(text);
    }
    return {
      mode: "instant",
      typing_budget_ms: 0,
      typing_elapsed_ms: 0,
      chunk_count: 1,
      chunk_sizes: [text.length],
      hesitation_count: 0,
      quick_burst_count: 0,
    };
  }

  const chunks = Array.isArray(plan?.chunks) ? plan.chunks : [text];
  const delays = Array.isArray(plan?.delays) ? plan.delays : [];
  const chunkSizes = [];
  for (let idx = 0; idx < chunks.length; idx += 1) {
    const chunk = String(chunks[idx] || "");
    if (!chunk) continue;
    await page.keyboard.insertText(chunk);
    chunkSizes.push(chunk.length);
    if (idx < delays.length) {
      const cancelled = await waitWithStrategy(page, delays[idx], waitFn);
      if (cancelled) {
        throw new Error("Cancellation requested during humanized typing.");
      }
    }
  }

  const typedValue = String(await readComposerValue(composer).catch(() => ""));
  if (typedValue !== text) {
    await clearComposer(composer);
    if (tagName === "textarea" || tagName === "input") {
      await composer.fill(text);
    } else {
      await composer.focus().catch(() => {});
      await page.keyboard.insertText(text);
    }
    return {
      mode: "chunked_fallback_to_exact_insert",
      typing_budget_ms: plan?.typing_budget_ms || 0,
      typing_elapsed_ms: plan?.typing_elapsed_ms || 0,
      chunk_count: chunks.length,
      chunk_sizes: chunkSizes,
      hesitation_count: plan?.hesitation_count || 0,
      quick_burst_count: plan?.quick_burst_count || 0,
      fallback_reason: "typed_value_mismatch",
    };
  }

  return {
    mode: "chunked",
    typing_budget_ms: plan?.typing_budget_ms || 0,
    typing_elapsed_ms: plan?.typing_elapsed_ms || 0,
    chunk_count: chunks.length,
    chunk_sizes: chunkSizes,
    hesitation_count: plan?.hesitation_count || 0,
    quick_burst_count: plan?.quick_burst_count || 0,
  };
}

export async function sendMessageInOpenThread({
  page,
  messageText,
  preSendDelayMs = 0,
  postSendDelayMs = 1500,
  humanization = null,
  waitFn = null,
}) {
  const text = String(messageText || "").trim();
  if (!text) {
    throw new Error("messageText is required.");
  }

  const messageLocator = page.getByText(text, { exact: true });
  const beforeCount = await messageLocator.count().catch(() => 0);
  const composer = await locateThreadComposer(page);
  const typingPlan = buildHumanizedTypingPlan(text, humanization || {});
  const typingResult = await typeComposerHumanized({
    page,
    composer,
    text,
    plan: typingPlan,
    waitFn,
  });

  if (Number.isFinite(preSendDelayMs) && preSendDelayMs > 0) {
    const cancelled = await waitWithStrategy(page, preSendDelayMs, waitFn);
    if (cancelled) {
      throw new Error("Cancellation requested during pre-send delay.");
    }
  }

  const sendButton = page.getByRole("button", { name: /^send$/i }).last();
  const sendButtonCount = await sendButton.count().catch(() => 0);

  if (sendButtonCount > 0) {
    await sendButton.click({ timeout: 3000 });
  } else {
    await composer.press("Enter");
  }

  if (Number.isFinite(postSendDelayMs) && postSendDelayMs > 0) {
    await waitWithStrategy(page, postSendDelayMs, waitFn);
  }

  const afterCount = await messageLocator.count().catch(() => 0);
  if (afterCount > beforeCount) {
    return {
      verified: true,
      verification_method: "text_count_increased",
      before_count: beforeCount,
      after_count: afterCount,
      typing: typingResult,
    };
  }

  const composerValue = String(await readComposerValue(composer).catch(() => "")).trim();
  if (!composerValue) {
    return {
      verified: true,
      verification_method: "composer_cleared",
      before_count: beforeCount,
      after_count: afterCount,
      typing: typingResult,
    };
  }

  throw new Error("Message send could not be verified.");
}
