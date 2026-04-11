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
const DEFAULT_RESULTS_PATH = path.join(DEFAULT_OUTPUT_DIR, "network_capture_results.json");
const INSTAGRAM_INBOX_URL = "https://www.instagram.com/direct/inbox/";
const NETWORK_WAIT_MS = 6000;

function parseArgs(argv) {
  const args = {
    debuggerUrl: DEFAULT_DEBUGGER_URL,
    leadsPath: DEFAULT_LEADS_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
    accountId: process.env.EDITOR_ACCOUNT_ID || "",
    leadId: "",
    username: "",
    threadUrl: "",
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
    } else if (token === "--help" || token === "-h") {
      printHelpAndExit(0);
    }
  }

  return args;
}

function printHelpAndExit(code) {
  console.log(`Instagram DM network capture probe

Usage:
  node scripts/instagram_dm/capture_thread_network.mjs --account-id <uuid> [--lead-id uuid] [--username handle] [--thread-url url] [--leads path] [--output-dir path] [--debugger-url http://127.0.0.1:9222]

Options:
  --account-id    Required. Account UUID whose outreach rows should be read
  --lead-id       Optional. Capture for one exact lead id
  --username      Optional. Capture for one exact username
  --thread-url    Optional. Override the stored thread URL with an exact thread URL
  --leads         JSON file containing an array of lead objects with ids/usernames
  --output-dir    Folder where results, payloads, and screenshots are written
  --debugger-url  Existing Chrome DevTools endpoint

Notes:
  If neither --lead-id nor --username is supplied, the script uses the first valid lead in the JSON file.
  If --username is not present in the JSON file, the script will look up that username directly in Supabase.
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

function pickLead(leads, args) {
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

async function loadLeadRowByUsername({ supabase, accountId, username }) {
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

  const row = Array.isArray(data) && data.length ? data[0] : null;
  return row;
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

async function getFreshPage(browser) {
  const contexts = browser.contexts();
  if (!contexts.length) {
    throw new Error("No browser contexts were available after connecting to Chrome.");
  }

  const context = contexts[0];
  const page = await context.newPage();
  return { context, page };
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

async function createNetworkCapture(page, payloadsDir, slugBase) {
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
        file_path: path.relative(process.cwd(), filePath),
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

function summarizeCaptures(captures) {
  const aggregate = {};
  for (const capture of captures) {
    for (const key of Object.keys(capture.candidate_fields_found || {})) {
      aggregate[key] = true;
    }
  }

  return {
    matched_response_count: captures.length,
    matched_urls: captures.map((item) => item.url),
    saved_payload_paths: captures.map((item) => item.file_path),
    candidate_fields_found: aggregate,
    capture_summaries: captures.map((item) => ({
      url: item.url,
      status: item.status,
      content_type: item.content_type,
      file_path: item.file_path,
      candidate_fields_found: item.candidate_fields_found,
      root_keys: item.root_keys,
    })),
  };
}

async function enableFreshNetworkCapture(page) {
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

async function main() {
  await loadLocalEnvFiles();
  const args = parseArgs(process.argv.slice(2));
  const accountId = String(args.accountId || "").trim();
  if (!accountId) {
    throw new Error("Missing account id. Pass --account-id <uuid> or set EDITOR_ACCOUNT_ID.");
  }

  const outputDir = path.resolve(args.outputDir);
  const screenshotsDir = path.join(outputDir, "screenshots");
  const payloadsDir = path.join(outputDir, "network_payloads");
  const resultsPath = path.join(outputDir, "network_capture_results.json");

  await ensureDir(outputDir);
  await ensureDir(screenshotsDir);
  await ensureDir(payloadsDir);

  const leads = await loadLeads(args.leadsPath);
  const supabase = getSupabaseAdminClient();
  const selectedLead = pickLead(leads, args);
  let selectedRow = null;

  if (selectedLead) {
    const dbRowsById = await loadLeadRowsFromDb({
      supabase,
      accountId,
      ids: [selectedLead.id],
    });
    selectedRow = dbRowsById.get(selectedLead.id) || null;
  } else if (args.username) {
    selectedRow = await loadLeadRowByUsername({
      supabase,
      accountId,
      username: args.username,
    });
    if (!selectedRow) {
      throw new Error(`No outreach row matched --username ${args.username} for account ${accountId}`);
    }
  } else {
    throw new Error("Could not resolve a lead target.");
  }

  const browser = await connectToBrowser(args.debuggerUrl);

  try {
    const { page } = await getFreshPage(browser);
    const cacheDisabled = await enableFreshNetworkCapture(page);
    const row = selectedRow;
    const username =
      normalizeUsername(row?.prospect_username) ||
      normalizeUsername(row?.username) ||
      selectedLead?.username ||
      args.username;
    const leadId = String(selectedLead?.id || row?.id || "").trim();
    const storedThreadUrl = String(args.threadUrl || row?.instagram_dm_thread_url || "").trim();
    const slugBase = `capture-${slugify(username)}`;

    console.log(`Loaded 1 lead from ${args.leadsPath}`);
    console.log(`Connected to Chrome via ${args.debuggerUrl}`);
    console.log(`Target lead: ${username} (${leadId || "no-local-lead-id"})`);
    console.log(`CDP cache disabled: ${cacheDisabled ? "yes" : "no"}`);

    const result = {
      lead_id: leadId || null,
      username,
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
    };

    const capture = await createNetworkCapture(page, payloadsDir, slugBase);

    try {
      if (!row) {
          throw new Error("Lead target was not found for the supplied account_id.");
      }

      if (storedThreadUrl) {
        console.log(`Trying stored thread for ${username}`);
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
            `Stored thread failed -> ${storedError instanceof Error ? storedError.message : String(storedError)}`
          );
        }
      } else {
        result.used_fallback = true;
        console.log(`No stored thread for ${username}; using fallback discovery`);
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

      console.log(`Thread open succeeded -> waiting ${NETWORK_WAIT_MS}ms for matching responses`);
      await page.waitForTimeout(NETWORK_WAIT_MS);
      await dismissCommonInstagramPrompts(page);
      await page.waitForTimeout(1000);

      const captures = await capture.stop();
      const summary = summarizeCaptures(captures);
      result.matched_response_count = summary.matched_response_count;
      result.matched_urls = summary.matched_urls;
      result.saved_payload_paths = summary.saved_payload_paths;
      result.candidate_fields_found = summary.candidate_fields_found;
      result.capture_summaries = summary.capture_summaries;
      result.capture_success = captures.length > 0;
      result.success = true;

      const screenshotPath = path.join(screenshotsDir, `${slugBase}-network-capture.png`);
      await saveScreenshot(page, screenshotPath);
      result.screenshot_path = path.relative(process.cwd(), screenshotPath);

      console.log(`Matched responses: ${result.matched_response_count}`);
      console.log(`Candidate fields found: ${Object.keys(result.candidate_fields_found).sort().join(", ") || "(none)"}`);
      console.log(`Results written to ${path.relative(process.cwd(), resultsPath)}`);
    } catch (error) {
      const captures = await capture.stop();
      const summary = summarizeCaptures(captures);
      result.matched_response_count = summary.matched_response_count;
      result.matched_urls = summary.matched_urls;
      result.saved_payload_paths = summary.saved_payload_paths;
      result.candidate_fields_found = summary.candidate_fields_found;
      result.capture_summaries = summary.capture_summaries;

      const screenshotPath = path.join(screenshotsDir, `${slugBase}-network-capture-fail.png`);
      try {
        await saveScreenshot(page, screenshotPath);
        result.screenshot_path = path.relative(process.cwd(), screenshotPath);
      } catch {
        // Ignore screenshot failures.
      }

      result.error_reason = error instanceof Error ? error.message : String(error);
      console.log(`Capture failed -> ${result.error_reason}`);
    }

    await saveResults(resultsPath, [result]);
    await page.close().catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("");
  console.error("Instagram thread network capture failed before completion.");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
