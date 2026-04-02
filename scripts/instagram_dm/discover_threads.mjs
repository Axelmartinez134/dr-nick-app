#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DEBUGGER_URL = "http://127.0.0.1:9222";
const DEFAULT_INPUT_PATH = path.join(__dirname, "usernames.json");
const DEFAULT_OUTPUT_DIR = path.join(__dirname, "output");
const DEFAULT_RESULTS_PATH = path.join(DEFAULT_OUTPUT_DIR, "results.json");
const INSTAGRAM_INBOX_URL = "https://www.instagram.com/direct/inbox/";

function parseArgs(argv) {
  const args = {
    debuggerUrl: DEFAULT_DEBUGGER_URL,
    inputPath: DEFAULT_INPUT_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let idx = 0; idx < argv.length; idx += 1) {
    const token = argv[idx];
    const next = argv[idx + 1];

    if (token === "--debugger-url" && next) {
      args.debuggerUrl = next;
      idx += 1;
    } else if (token === "--input" && next) {
      args.inputPath = path.resolve(process.cwd(), next);
      idx += 1;
    } else if (token === "--output-dir" && next) {
      args.outputDir = path.resolve(process.cwd(), next);
      idx += 1;
    } else if (token === "--help" || token === "-h") {
      printHelpAndExit(0);
    }
  }

  return args;
}

function printHelpAndExit(code) {
  console.log(`Instagram DM thread discovery spike

Usage:
  node scripts/instagram_dm/discover_threads.mjs [--input path] [--output-dir path] [--debugger-url http://127.0.0.1:9222]

Options:
  --input         JSON file containing an array of usernames
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

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function loadUsernames(inputPath) {
  const raw = await fs.readFile(inputPath, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected ${inputPath} to contain a JSON array.`);
  }

  const usernames = parsed
    .map((value) => normalizeUsername(value))
    .filter(Boolean);

  if (!usernames.length) {
    throw new Error(`No valid usernames found in ${inputPath}.`);
  }

  return usernames;
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
  const existingPage = context.pages().find((page) => {
    const url = page.url();
    return url.startsWith("https://www.instagram.com/");
  });

  if (existingPage) {
    return existingPage;
  }

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
        // Ignore transient or already-dismissed prompts.
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
      // Try the next locator.
    }
  }

  throw new Error("Could not find the inbox search input.");
}

async function findResultLocator(page, username) {
  const exactProfileHref = page.locator(`a[href="/${username}/"]`).first();
  if (await exactProfileHref.count()) {
    return exactProfileHref;
  }

  const textMatch = page.getByText(new RegExp(`^@?${username}$`, "i")).first();
  if (await textMatch.count()) {
    return textMatch;
  }

  const fuzzyText = page.getByText(new RegExp(username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")).first();
  if (await fuzzyText.count()) {
    return fuzzyText;
  }

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

  const textLocator = page.getByText(new RegExp(username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")).first();
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

async function saveScreenshot(page, filePath) {
  await page.screenshot({ path: filePath, fullPage: true });
}

async function saveResults(resultsPath, results) {
  await fs.writeFile(resultsPath, `${JSON.stringify(results, null, 2)}\n`, "utf-8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(args.outputDir);
  const screenshotsDir = path.join(outputDir, "screenshots");
  const resultsPath = path.join(outputDir, "results.json");

  await ensureDir(outputDir);
  await ensureDir(screenshotsDir);

  const usernames = await loadUsernames(args.inputPath);
  const browser = await connectToBrowser(args.debuggerUrl);

  try {
    const page = await getOrCreatePage(browser);
    const results = [];

    console.log(`Loaded ${usernames.length} usernames from ${args.inputPath}`);
    console.log(`Connected to Chrome via ${args.debuggerUrl}`);

    for (let idx = 0; idx < usernames.length; idx += 1) {
      const username = usernames[idx];
      const stepLabel = `[${idx + 1}/${usernames.length}] ${username}`;
      const screenshotBase = `${String(idx + 1).padStart(2, "0")}-${slugify(username)}`;

      console.log(`${stepLabel} -> searching`);

      const result = {
        username,
        success: false,
        thread_url: null,
        verification_passed: false,
        error_reason: null,
        timestamp: new Date().toISOString(),
        screenshot_path: null,
      };

      try {
        await searchAndOpenThread(page, username);
        result.thread_url = page.url();
        result.verification_passed = await verifyThreadOwner(page, username);

        if (!result.thread_url.includes("/direct/t/")) {
          throw new Error("Opened page did not produce a /direct/t/ thread URL.");
        }

        if (!result.verification_passed) {
          throw new Error("Thread opened but participant verification failed.");
        }

        const screenshotPath = path.join(screenshotsDir, `${screenshotBase}-success.png`);
        await saveScreenshot(page, screenshotPath);

        result.success = true;
        result.screenshot_path = path.relative(process.cwd(), screenshotPath);
        console.log(`${stepLabel} -> SUCCESS -> ${result.thread_url}`);
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
    console.log("");
    console.log(`Completed thread discovery: ${successCount}/${results.length} succeeded.`);
    console.log(`Results written to ${path.relative(process.cwd(), resultsPath)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("");
  console.error("Instagram thread discovery failed before completion.");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
