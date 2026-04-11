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
const DEFAULT_RESULTS_PATH = path.join(DEFAULT_OUTPUT_DIR, "resolve_results.json");
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
  console.log(`Instagram DM stored-thread reuse with fallback discovery

Usage:
  node scripts/instagram_dm/reuse_or_discover_threads.mjs --account-id <uuid> [--leads path] [--output-dir path] [--debugger-url http://127.0.0.1:9222]

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

async function main() {
  await loadLocalEnvFiles();
  const args = parseArgs(process.argv.slice(2));
  const accountId = String(args.accountId || "").trim();
  if (!accountId) {
    throw new Error("Missing account id. Pass --account-id <uuid> or set EDITOR_ACCOUNT_ID.");
  }

  const outputDir = path.resolve(args.outputDir);
  const screenshotsDir = path.join(outputDir, "screenshots");
  const resultsPath = path.join(outputDir, "resolve_results.json");

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

            result.success = true;
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

        if (!result.success) {
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

          result.success = true;
          result.resolution_source = storedThreadUrl ? "fallback_discovery" : "discovery_only";
          result.discovered_new_thread = result.thread_url !== storedThreadUrl;
        }

        const suffix =
          result.resolution_source === "stored"
            ? "stored-success"
            : result.resolution_source === "fallback_discovery"
              ? "fallback-success"
              : "discovery-success";
        const screenshotPath = path.join(screenshotsDir, `${screenshotBase}-${suffix}.png`);
        await saveScreenshot(page, screenshotPath);
        result.screenshot_path = path.relative(process.cwd(), screenshotPath);

        console.log(
          `${stepLabel} -> SUCCESS -> source=${result.resolution_source} -> ${result.thread_url}`
        );
      } catch (error) {
        const screenshotPath = path.join(screenshotsDir, `${screenshotBase}-fail.png`);
        try {
          await saveScreenshot(page, screenshotPath);
          result.screenshot_path = path.relative(process.cwd(), screenshotPath);
        } catch {
          // Ignore screenshot failures.
        }

        result.error_reason = error instanceof Error ? error.message : String(error);
        console.log(`${stepLabel} -> FAIL -> ${result.error_reason}`);
      }

      results.push(result);
      await saveResults(resultsPath, results);
      await page.waitForTimeout(1500);
    }

    const successCount = results.filter((item) => item.success).length;
    const storedCount = results.filter((item) => item.resolution_source === "stored").length;
    const fallbackCount = results.filter((item) => item.resolution_source === "fallback_discovery").length;
    const discoveryOnlyCount = results.filter((item) => item.resolution_source === "discovery_only").length;

    console.log("");
    console.log(`Completed thread resolution: ${successCount}/${results.length} succeeded.`);
    console.log(`Stored thread successes: ${storedCount}`);
    console.log(`Fallback discovery successes: ${fallbackCount}`);
    console.log(`Discovery-only successes: ${discoveryOnlyCount}`);
    console.log(`Results written to ${path.relative(process.cwd(), resultsPath)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("");
  console.error("Instagram stored-thread resolution failed before completion.");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
