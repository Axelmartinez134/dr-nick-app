#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const DEFAULT_DEBUGGER_URL = "http://127.0.0.1:9222";
const DEFAULT_LEADS_PATH = path.join(__dirname, "test_leads.json");
const DEFAULT_OUTPUT_DIR = path.join(__dirname, "output");
const DEFAULT_RESULTS_PATH = path.join(DEFAULT_OUTPUT_DIR, "inspect_results.json");
const INSTAGRAM_INBOX_URL = "https://www.instagram.com/direct/inbox/";

function parseArgs(argv) {
  const args = {
    debuggerUrl: DEFAULT_DEBUGGER_URL,
    leadsPath: DEFAULT_LEADS_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
    accountId: process.env.EDITOR_ACCOUNT_ID || "",
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
    } else if (token === "--help" || token === "-h") {
      printHelpAndExit(0);
    }
  }

  return args;
}

function printHelpAndExit(code) {
  console.log(`Instagram DM thread-state inspection

Usage:
  node scripts/instagram_dm/inspect_thread_states.mjs --account-id <uuid> [--leads path] [--output-dir path] [--debugger-url http://127.0.0.1:9222]

Options:
  --account-id    Required. Account UUID whose outreach rows should be read
  --leads         JSON file containing an array of lead objects with ids/usernames
  --output-dir    Folder where results and screenshots are written
  --debugger-url  Existing Chrome DevTools endpoint
`);
  process.exit(code);
}

function normalizeUsername(value) {
  return String(value || "").trim().replace(/^@+/, "").toLowerCase();
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
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
      // Ignore missing env files.
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

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function saveResults(resultsPath, results) {
  await fs.writeFile(resultsPath, `${JSON.stringify(results, null, 2)}\n`, "utf-8");
}

async function saveScreenshot(page, filePath) {
  await page.screenshot({ path: filePath, fullPage: true });
}

async function loadLeads(leadsPath) {
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

async function loadLeadRowsFromDb({ supabase, accountId, ids }) {
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

async function connectToBrowser(debuggerUrl) {
  return chromium.connectOverCDP(debuggerUrl);
}

async function getOrCreatePage(browser) {
  const contexts = browser.contexts();
  if (!contexts.length) {
    throw new Error("No browser contexts were available after connecting to Chrome.");
  }

  const context = contexts[0];
  const existingPage = context.pages().find((page) => page.url().startsWith("https://www.instagram.com/"));
  if (existingPage) return existingPage;
  return context.newPage();
}

async function dismissCommonInstagramPrompts(page) {
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

async function gotoInbox(page) {
  await page.goto(INSTAGRAM_INBOX_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await dismissCommonInstagramPrompts(page);
}

async function locateSearchInput(page) {
  const candidates = [
    page.getByPlaceholder("Search").first(),
    page.getByRole("textbox", { name: /search/i }).first(),
    page.locator('input[placeholder="Search"]').first(),
    page.locator('input[aria-label="Search"]').first(),
    page.locator('input[type="text"]').first(),
  ];

  for (const locator of candidates) {
    try {
      await locator.waitFor({ state: "visible", timeout: 2000 });
      return locator;
    } catch {
      // Try next locator.
    }
  }

  throw new Error("Could not find the inbox search input.");
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

async function searchAndOpenThread(page, username) {
  await gotoInbox(page);

  const searchInput = await locateSearchInput(page);
  await searchInput.click();
  await page.waitForTimeout(300);
  await searchInput.fill(username);
  await page.waitForTimeout(2500);

  const resultLocator = await findResultLocator(page, username);
  if (!resultLocator) {
    throw new Error("No matching inbox result was found.");
  }

  await resultLocator.click({ timeout: 5000 });
  await page.waitForURL(/\/direct\/t\/.+/, { timeout: 10000 });
  await page.waitForTimeout(1500);
}

async function openStoredThread(page, threadUrl) {
  await page.goto(threadUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await dismissCommonInstagramPrompts(page);
  await page.waitForTimeout(1500);

  if (!page.url().includes("/direct/t/")) {
    throw new Error("Stored thread URL did not resolve to a /direct/t/ page.");
  }
}

async function verifyThreadOwner(page, username) {
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

async function scrollThreadToBottom(page) {
  for (let idx = 0; idx < 4; idx += 1) {
    await page.evaluate(() => {
      const isVisible = (el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          style.opacity !== "0"
        );
      };

      const composerCandidates = Array.from(
        document.querySelectorAll('textarea, input[placeholder*="Message"], div[contenteditable="true"]')
      ).filter((el) => el instanceof HTMLElement && isVisible(el));

      const composer =
        composerCandidates.find((el) => /message/i.test(el.getAttribute("placeholder") || "")) ||
        composerCandidates.find((el) => /message/i.test(el.getAttribute("aria-label") || "")) ||
        composerCandidates.find((el) => /message/i.test(el.textContent || ""));

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const threadPaneCandidates = [];

      let cursor = composer instanceof HTMLElement ? composer.parentElement : null;
      while (cursor instanceof HTMLElement) {
        const rect = cursor.getBoundingClientRect();
        if (
          isVisible(cursor) &&
          rect.left >= viewportWidth * 0.22 &&
          rect.width >= viewportWidth * 0.35 &&
          rect.height >= viewportHeight * 0.45
        ) {
          threadPaneCandidates.push(cursor);
        }
        cursor = cursor.parentElement;
      }

      threadPaneCandidates.sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        return aRect.left - bRect.left || bRect.width * bRect.height - aRect.width * aRect.height;
      });

      const threadPane =
        threadPaneCandidates[0] ||
        (document.querySelector("main") instanceof HTMLElement ? document.querySelector("main") : document.body);

      const paneRect = threadPane.getBoundingClientRect();
      const candidates = [threadPane, ...Array.from(threadPane.querySelectorAll("*"))]
        .filter((el) => el instanceof HTMLElement)
        .filter((el) => isVisible(el))
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return (
            rect.left >= paneRect.left - 8 &&
            rect.right <= paneRect.right + 8 &&
            rect.top >= paneRect.top - 8 &&
            rect.bottom <= paneRect.bottom + 8 &&
            el.scrollHeight - el.clientHeight > 120 &&
            rect.height >= 140
          );
        });

      candidates.sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        const aScore =
          (a.scrollHeight - a.clientHeight) +
          aRect.width * aRect.height +
          (aRect.left >= viewportWidth * 0.25 ? 200000 : 0);
        const bScore =
          (b.scrollHeight - b.clientHeight) +
          bRect.width * bRect.height +
          (bRect.left >= viewportWidth * 0.25 ? 200000 : 0);
        return bScore - aScore;
      });

      const target = candidates[0];
      if (target) {
        target.scrollTop = target.scrollHeight;
      } else {
        window.scrollTo(0, document.body.scrollHeight);
      }
    });
    await page.waitForTimeout(350);
  }
}

async function dismissThreadOverlays(page) {
  await dismissCommonInstagramPrompts(page);
  const maybeClick = async (label) => {
    const locator = page.getByRole("button", { name: new RegExp(`^${label}$`, "i") }).first();
    if (await locator.count()) {
      try {
        if (await locator.isVisible({ timeout: 500 })) {
          await locator.click({ timeout: 1000 });
          await page.waitForTimeout(400);
        }
      } catch {
        // Ignore transient overlays.
      }
    }
  };

  await maybeClick("Close");
  await maybeClick("Done");
}

async function collectVisibleThreadSignals(page) {
  const signals = await page.evaluate(() => {
    const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        style.opacity !== "0"
      );
    };

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const composerCandidates = Array.from(
      document.querySelectorAll('textarea, input[placeholder*="Message"], div[contenteditable="true"]')
    ).filter((el) => el instanceof HTMLElement && isVisible(el));
    const composer =
      composerCandidates.find((el) => /message/i.test(el.getAttribute("placeholder") || "")) ||
      composerCandidates.find((el) => /message/i.test(el.getAttribute("aria-label") || "")) ||
      composerCandidates.find((el) => /message/i.test(el.textContent || ""));

    const threadPaneCandidates = [];
    let cursor = composer instanceof HTMLElement ? composer.parentElement : null;
    while (cursor instanceof HTMLElement) {
      const rect = cursor.getBoundingClientRect();
      if (
        isVisible(cursor) &&
        rect.left >= viewportWidth * 0.22 &&
        rect.width >= viewportWidth * 0.35 &&
        rect.height >= viewportHeight * 0.45
      ) {
        threadPaneCandidates.push(cursor);
      }
      cursor = cursor.parentElement;
    }

    threadPaneCandidates.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return aRect.left - bRect.left || bRect.width * bRect.height - aRect.width * aRect.height;
    });

    const root =
      threadPaneCandidates[0] ||
      (document.querySelector("main") instanceof HTMLElement ? document.querySelector("main") : document.body);
    const rootRect = root.getBoundingClientRect();
    const centerX = rootRect.left + rootRect.width / 2;
    const composerRect =
      composer instanceof HTMLElement ? composer.getBoundingClientRect() : { top: rootRect.bottom - 64 };
    const verticalMin = rootRect.top + Math.max(56, rootRect.height * 0.08);
    const verticalMax = Math.min(rootRect.bottom - 24, composerRect.top - 10);
    const ignoreExact = new Set([
      "message...",
      "type a message...",
      "type a message",
      "camera",
      "voice call",
      "video chat",
      "profile",
      "details",
      "more",
      "view profile",
      "user-profile-picture",
      "learn more",
    ]);
    const ignorePattern =
      /^(search|active now|instagram|chat info|message|send message|loading|new messages?|today|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|auto-detected outcome)$/i;
    const timestampPattern =
      /^(today|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|[0-9]{1,2}:[0-9]{2}\s?(am|pm)?|[a-z]{3}\s[0-9]{1,2},\s[0-9]{4},?\s[0-9]{1,2}:[0-9]{2}\s?(am|pm)?)$/i;
    const seenPattern = /^seen(?: by .*?)?$/i;
    const metadataPattern =
      /^(you replied to |replied to |sent an attachment\.?|you sent an attachment\.?|you sent a photo\.?|liked a message|shared a post\.?|shared a reel\.?)/i;
    const dedupe = new Set();
    const nodes = [];

    for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) {
      if (!(el instanceof HTMLElement)) continue;
      if (!isVisible(el)) continue;
      if (el.matches("input, textarea, svg, path, video, canvas")) continue;

      const rect = el.getBoundingClientRect();
      if (rect.bottom < verticalMin || rect.top > verticalMax) continue;
      if (rect.left < rootRect.left - 8 || rect.right > rootRect.right + 8) continue;

      const ownText = cleanText(el.innerText);
      const aria = cleanText(el.getAttribute("aria-label"));
      const alt = cleanText(el.getAttribute("alt"));
      const text = ownText || aria || alt;
      if (!text) continue;
      if (text.length > 200) continue;

      const childWithSameText = Array.from(el.children).some((child) => {
        if (!(child instanceof HTMLElement)) return false;
        return cleanText(child.innerText) === text;
      });
      if (childWithSameText) continue;

      const lower = text.toLowerCase();
      if (ignoreExact.has(lower) || ignorePattern.test(text)) continue;
      const key = [
        lower,
        Math.round(rect.top / 8),
        Math.round(rect.left / 8),
        Math.round(rect.width / 8),
      ].join("|");
      if (dedupe.has(key)) continue;
      dedupe.add(key);

      const laneCenter = rect.left + rect.width / 2;
      let lane = "center";
      if (laneCenter <= centerX - rootRect.width * 0.08) lane = "left";
      else if (laneCenter >= centerX + rootRect.width * 0.08) lane = "right";

      nodes.push({
        text,
        lane,
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        is_seen: seenPattern.test(text),
        is_timestamp: timestampPattern.test(text),
        is_metadata: metadataPattern.test(text),
      });
    }

    nodes.sort((a, b) => {
      if (b.bottom !== a.bottom) return b.bottom - a.bottom;
      if (b.top !== a.top) return b.top - a.top;
      return a.left - b.left;
    });

    const messageLikeNodes = nodes.filter((node) => !node.is_seen && !node.is_timestamp && !node.is_metadata);
    const latestCandidate = messageLikeNodes[0] || null;
    const topBand = messageLikeNodes.slice(0, 8);
    const leftCount = topBand.filter((node) => node.lane === "left").length;
    const rightCount = topBand.filter((node) => node.lane === "right").length;
    const ambiguityFlags = [];

    if (!latestCandidate) {
      ambiguityFlags.push("no_message_candidates");
    }
    if (latestCandidate && latestCandidate.lane === "center") {
      ambiguityFlags.push("latest_candidate_center_aligned");
    }
    if (
      topBand.length >= 2 &&
      topBand[0].lane !== topBand[1].lane &&
      Math.abs(topBand[0].bottom - topBand[1].bottom) <= 18
    ) {
      ambiguityFlags.push("mixed_alignment_near_latest_message");
    }
    if (!leftCount && !rightCount) {
      ambiguityFlags.push("no_left_or_right_candidates_detected");
    }
    if (rootRect.left < viewportWidth * 0.2) {
      ambiguityFlags.push("thread_pane_not_right_anchored");
    }
    if (verticalMax <= verticalMin) {
      ambiguityFlags.push("thread_window_invalid");
    }

    const seenCandidate = nodes.find((node) => node.is_seen) || null;

    return {
      seen_indicator_text: seenCandidate ? seenCandidate.text : null,
      latest_candidate: latestCandidate,
      top_candidates: topBand,
      thread_pane_left: Math.round(rootRect.left),
      thread_pane_width: Math.round(rootRect.width),
      left_count: leftCount,
      right_count: rightCount,
      ambiguity_flags: ambiguityFlags,
    };
  });

  return {
    seen_indicator_text:
      typeof signals?.seen_indicator_text === "string" && signals.seen_indicator_text.trim()
        ? signals.seen_indicator_text.trim()
        : null,
    latest_candidate: signals?.latest_candidate ?? null,
    top_candidates: Array.isArray(signals?.top_candidates) ? signals.top_candidates : [],
    thread_pane_left:
      typeof signals?.thread_pane_left === "number" && Number.isFinite(signals.thread_pane_left)
        ? signals.thread_pane_left
        : null,
    thread_pane_width:
      typeof signals?.thread_pane_width === "number" && Number.isFinite(signals.thread_pane_width)
        ? signals.thread_pane_width
        : null,
    left_count:
      typeof signals?.left_count === "number" && Number.isFinite(signals.left_count)
        ? signals.left_count
        : 0,
    right_count:
      typeof signals?.right_count === "number" && Number.isFinite(signals.right_count)
        ? signals.right_count
        : 0,
    ambiguity_flags: Array.isArray(signals?.ambiguity_flags)
      ? signals.ambiguity_flags.map((value) => String(value || "").trim()).filter(Boolean)
      : [],
  };
}

function classifyThreadState(signals) {
  const latest = signals.latest_candidate || null;
  const seenText = signals.seen_indicator_text || null;
  const flags = Array.isArray(signals.ambiguity_flags) ? [...signals.ambiguity_flags] : [];

  if (flags.includes("thread_pane_not_right_anchored") || flags.includes("thread_window_invalid")) {
    return {
      inspection_state: "review_ambiguous",
      recommended_action: "human_review",
      has_visible_inbound_reply: false,
      ambiguity_flags: Array.from(new Set(flags)),
    };
  }

  if (!latest) {
    return {
      inspection_state: "review_ambiguous",
      recommended_action: "human_review",
      has_visible_inbound_reply: false,
      ambiguity_flags: Array.from(new Set(flags)),
    };
  }

  if (latest.lane === "left") {
    return {
      inspection_state: "review_replied_or_ongoing",
      recommended_action: "human_review",
      has_visible_inbound_reply: true,
      ambiguity_flags: Array.from(new Set(flags)),
    };
  }

  if (latest.lane === "right") {
    return {
      inspection_state: seenText ? "safe_seen_no_reply" : "safe_unseen_no_reply",
      recommended_action: seenText ? "hold_waiting" : "candidate_followup",
      has_visible_inbound_reply: false,
      ambiguity_flags: Array.from(new Set(flags)),
    };
  }

  return {
    inspection_state: "review_ambiguous",
    recommended_action: "human_review",
    has_visible_inbound_reply: false,
    ambiguity_flags: Array.from(new Set(flags)),
  };
}

async function inspectOpenedThread(page) {
  await dismissThreadOverlays(page);
  await scrollThreadToBottom(page);
  await page.waitForTimeout(1200);
  await dismissThreadOverlays(page);

  const signals = await collectVisibleThreadSignals(page);
  const classification = classifyThreadState(signals);
  return { signals, classification };
}

async function main() {
  await loadLocalEnvFiles();
  const args = parseArgs(process.argv.slice(2));
  const accountId = String(args.accountId || "").trim();
  if (!accountId) {
    throw new Error("Missing account id. Pass --account-id <uuid> or set EDITOR_ACCOUNT_ID.");
  }

  const outputDir = path.resolve(args.outputDir);
  const screenshotsDir = path.join(outputDir, "screenshots");
  const resultsPath = path.join(outputDir, "inspect_results.json");

  await ensureDir(outputDir);
  await ensureDir(screenshotsDir);

  const leads = await loadLeads(args.leadsPath);
  const supabase = getSupabaseAdminClient();
  const dbRowsById = await loadLeadRowsFromDb({
    supabase,
    accountId,
    ids: leads.map((lead) => lead.id),
  });
  const browser = await connectToBrowser(args.debuggerUrl);

  try {
    const page = await getOrCreatePage(browser);
    const results = [];

    console.log(`Loaded ${leads.length} leads from ${args.leadsPath}`);
    console.log(`Loaded ${dbRowsById.size} outreach rows for account ${accountId}`);
    console.log(`Connected to Chrome via ${args.debuggerUrl}`);

    for (let idx = 0; idx < leads.length; idx += 1) {
      const lead = leads[idx];
      const row = dbRowsById.get(lead.id) || null;
      const username =
        normalizeUsername(row?.prospect_username) ||
        normalizeUsername(row?.username) ||
        lead.username;
      const storedThreadUrl = String(row?.instagram_dm_thread_url || "").trim();
      const stepLabel = `[${idx + 1}/${leads.length}] ${username}`;
      const screenshotBase = `${String(idx + 1).padStart(2, "0")}-${slugify(username)}`;

      const result = {
        lead_id: lead.id,
        username,
        success: false,
        thread_url: null,
        thread_id: null,
        verification_passed: false,
        resolution_source: null,
        stored_thread_url_before: storedThreadUrl || null,
        used_fallback: false,
        discovered_new_thread: false,
        inspection_state: null,
        recommended_action: null,
        seen_indicator_text: null,
        has_visible_inbound_reply: false,
        latest_candidate_lane: null,
        latest_candidate_text: null,
        thread_pane_left: null,
        thread_pane_width: null,
        visible_thread_text_samples: [],
        ambiguity_flags: [],
        error_reason: null,
        timestamp: new Date().toISOString(),
        screenshot_path: null,
      };

      try {
        if (!row) {
          throw new Error("Lead id was not found for the supplied account_id.");
        }

        if (storedThreadUrl) {
          console.log(`${stepLabel} -> trying stored thread`);
          try {
            await openStoredThread(page, storedThreadUrl);
            result.thread_url = page.url();
            result.thread_id = deriveThreadIdFromUrl(result.thread_url);
            result.verification_passed = await verifyThreadOwner(page, username);

            if (!result.verification_passed) {
              throw new Error("Stored thread opened but participant verification failed.");
            }

            result.resolution_source = "stored";
          } catch (storedError) {
            result.used_fallback = true;
            console.log(
              `${stepLabel} -> stored thread failed -> ${storedError instanceof Error ? storedError.message : String(storedError)}`
            );
          }
        } else {
          result.used_fallback = true;
          console.log(`${stepLabel} -> no stored thread -> using fallback discovery`);
        }

        if (!result.resolution_source) {
          await searchAndOpenThread(page, username);
          result.thread_url = page.url();
          result.thread_id = deriveThreadIdFromUrl(result.thread_url);
          result.verification_passed = await verifyThreadOwner(page, username);

          if (!result.thread_url.includes("/direct/t/")) {
            throw new Error("Fallback discovery did not produce a /direct/t/ thread URL.");
          }

          if (!result.verification_passed) {
            throw new Error("Fallback discovery opened a thread but participant verification failed.");
          }

          result.resolution_source = storedThreadUrl ? "fallback_discovery" : "discovery_only";
          result.discovered_new_thread = result.thread_url !== storedThreadUrl;
        }

        const { signals, classification } = await inspectOpenedThread(page);
        result.inspection_state = classification.inspection_state;
        result.recommended_action = classification.recommended_action;
        result.has_visible_inbound_reply = classification.has_visible_inbound_reply;
        result.seen_indicator_text = signals.seen_indicator_text;
        result.latest_candidate_lane = signals.latest_candidate?.lane || null;
        result.latest_candidate_text = signals.latest_candidate?.text || null;
        result.thread_pane_left = signals.thread_pane_left;
        result.thread_pane_width = signals.thread_pane_width;
        result.visible_thread_text_samples = signals.top_candidates.map((candidate) => ({
          lane: candidate.lane,
          text: candidate.text,
        }));
        result.ambiguity_flags = classification.ambiguity_flags;
        result.success = result.inspection_state !== "failed_to_inspect";

        const suffix =
          result.inspection_state === "safe_seen_no_reply"
            ? "seen-no-reply"
            : result.inspection_state === "safe_unseen_no_reply"
              ? "unseen-no-reply"
              : result.inspection_state === "review_replied_or_ongoing"
                ? "review-replied"
                : "review-ambiguous";
        const screenshotPath = path.join(screenshotsDir, `${screenshotBase}-${suffix}.png`);
        await saveScreenshot(page, screenshotPath);
        result.screenshot_path = path.relative(process.cwd(), screenshotPath);

        console.log(
          `${stepLabel} -> ${result.inspection_state} -> action=${result.recommended_action} -> latest=${result.latest_candidate_lane || "none"}`
        );
      } catch (error) {
        const screenshotPath = path.join(screenshotsDir, `${screenshotBase}-fail.png`);
        try {
          await saveScreenshot(page, screenshotPath);
          result.screenshot_path = path.relative(process.cwd(), screenshotPath);
        } catch {
          // Ignore screenshot failures.
        }

        result.inspection_state = "failed_to_inspect";
        result.recommended_action = "inspect_retry";
        result.error_reason = error instanceof Error ? error.message : String(error);
        console.log(`${stepLabel} -> FAIL -> ${result.error_reason}`);
      }

      results.push(result);
      await saveResults(resultsPath, results);
      await page.waitForTimeout(1500);
    }

    const successCount = results.filter((item) => item.success).length;
    const unseenCount = results.filter((item) => item.inspection_state === "safe_unseen_no_reply").length;
    const seenCount = results.filter((item) => item.inspection_state === "safe_seen_no_reply").length;
    const reviewCount = results.filter((item) => item.inspection_state === "review_replied_or_ongoing").length;
    const ambiguousCount = results.filter((item) => item.inspection_state === "review_ambiguous").length;
    const failedCount = results.filter((item) => item.inspection_state === "failed_to_inspect").length;

    console.log("");
    console.log(`Completed thread inspection: ${successCount}/${results.length} classified successfully.`);
    console.log(`safe_unseen_no_reply: ${unseenCount}`);
    console.log(`safe_seen_no_reply: ${seenCount}`);
    console.log(`review_replied_or_ongoing: ${reviewCount}`);
    console.log(`review_ambiguous: ${ambiguousCount}`);
    console.log(`failed_to_inspect: ${failedCount}`);
    console.log(`Results written to ${path.relative(process.cwd(), resultsPath)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("");
  console.error("Instagram thread-state inspection failed before completion.");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
