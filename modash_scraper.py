#!/usr/bin/env python3
"""
Modash Instagram list scraper (v1).

Purpose
-------
- Attach to an already-open Chrome window via the remote debugging port.
- Scrape ONLY the main results list page on Modash.
- Never click the "View" modal because that spends credits.
- Export one timestamped CSV per run.

Important limitations
---------------------
This first version is intentionally built to be easy to refine.
I do not know Modash's exact DOM structure from code alone, so the scraper:
- uses resilient heuristics where possible
- isolates tweakable selectors in one place
- saves debug artifacts so selectors can be adjusted quickly

Typical workflow
----------------
1. Start Chrome with remote debugging enabled.
2. Log in manually to Modash.
3. Apply your filters and manually open the page you want to start from.
4. Run this script with --start-page matching the page number you are on.
5. Inspect the CSV and debug artifacts.
6. Refine selectors if needed.
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, List, Optional

from selenium import webdriver
from selenium.common.exceptions import (
    JavascriptException,
    StaleElementReferenceException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver import Chrome
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support.ui import WebDriverWait


# ============================================================================
# Tweakable settings
# ============================================================================

DEFAULT_DEBUGGER_ADDRESS = "127.0.0.1:9222"
DEFAULT_MIN_DELAY_SECONDS = 4
DEFAULT_MAX_DELAY_SECONDS = 12
DEFAULT_MAX_PAGES = 1000
DEFAULT_PAGE_LOAD_TIMEOUT = 25
DEBUG_LINE_SLOTS = 12

# These selectors are intentionally isolated so they are easy to refine.
ACTIVE_PAGE_SELECTORS = [
    "[aria-current='page']",
    "[aria-current='true']",
    ".active",
    ".is-active",
    ".selected",
    ".current",
]

NEXT_BUTTON_XPATHS = [
    "//button[normalize-space()='Next']",
    "//a[normalize-space()='Next']",
    "//*[self::button or self::a][.//*[normalize-space()='Next']]",
]

HANDLE_XPATH = (
    "//*[self::a or self::button or self::span or self::div or self::p]"
    "[starts-with(normalize-space(.), '@')]"
)

NUMERIC_TOKEN_PATTERN = re.compile(
    r"(?i)\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*[kmb]?\b"
)
PERCENT_PATTERN = re.compile(r"\b\d+(?:\.\d+)?%")
HANDLE_PATTERN = re.compile(r"@[A-Za-z0-9._]+")


@dataclass
class RowRecord:
    scrape_timestamp: str
    page_number: int
    row_number: int
    inferred_name: str
    inferred_handle: str
    inferred_followers: str
    inferred_er: str
    inferred_engagement: str
    numeric_tokens: str
    percent_tokens: str
    all_visible_text: str
    visible_lines_json: str
    debug_notes: str
    line_slots: List[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape the visible Modash results list into a timestamped CSV."
    )
    parser.add_argument(
        "--start-page",
        type=int,
        required=True,
        help="The page number you have already opened manually in Chrome.",
    )
    parser.add_argument(
        "--debugger-address",
        default=DEFAULT_DEBUGGER_ADDRESS,
        help=f"Chrome remote debugging address. Default: {DEFAULT_DEBUGGER_ADDRESS}",
    )
    parser.add_argument(
        "--min-delay",
        type=float,
        default=DEFAULT_MIN_DELAY_SECONDS,
        help=f"Minimum delay between pages. Default: {DEFAULT_MIN_DELAY_SECONDS}",
    )
    parser.add_argument(
        "--max-delay",
        type=float,
        default=DEFAULT_MAX_DELAY_SECONDS,
        help=f"Maximum delay between pages. Default: {DEFAULT_MAX_DELAY_SECONDS}",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=DEFAULT_MAX_PAGES,
        help=f"Safety cap on pages scraped in one run. Default: {DEFAULT_MAX_PAGES}",
    )
    parser.add_argument(
        "--output-dir",
        default="modash_exports",
        help="Directory where CSVs and debug artifacts are written.",
    )
    parser.add_argument(
        "--skip-page-validation",
        action="store_true",
        help=(
            "Skip validating the active page number. Use this only if Modash's "
            "pagination DOM changes and the current-page detector needs tuning."
        ),
    )
    return parser.parse_args()


def now_slug() -> str:
    return datetime.now().strftime("%Y-%m-%d_%H-%M-%S")


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def ensure_output_paths(base_dir: Path) -> tuple[Path, Path]:
    base_dir.mkdir(parents=True, exist_ok=True)
    debug_dir = base_dir / "debug"
    debug_dir.mkdir(parents=True, exist_ok=True)
    return base_dir, debug_dir


def create_driver(debugger_address: str) -> Chrome:
    options = Options()
    options.add_experimental_option("debuggerAddress", debugger_address)

    try:
        driver = webdriver.Chrome(options=options)
    except WebDriverException as exc:
        raise SystemExit(
            "\nCould not attach to Chrome.\n"
            "Make sure Chrome was started with the remote debugging port enabled.\n"
            f"Debugger address attempted: {debugger_address}\n"
            f"Original error: {exc}\n"
        ) from exc

    driver.set_page_load_timeout(DEFAULT_PAGE_LOAD_TIMEOUT)
    return driver


def wait_for_document_ready(driver: Chrome, timeout: int = 20) -> None:
    WebDriverWait(driver, timeout).until(
        lambda d: d.execute_script("return document.readyState") == "complete"
    )


def dump_debug_artifacts(driver: Chrome, debug_dir: Path, label: str) -> tuple[Path, Path]:
    html_path = debug_dir / f"{label}.html"
    screenshot_path = debug_dir / f"{label}.png"
    html_path.write_text(driver.page_source, encoding="utf-8")
    driver.save_screenshot(str(screenshot_path))
    return html_path, screenshot_path


def is_visible(driver: Chrome, element: WebElement) -> bool:
    try:
        return bool(
            driver.execute_script(
                """
                const el = arguments[0];
                if (!el) return false;
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return (
                    style &&
                    style.visibility !== 'hidden' &&
                    style.display !== 'none' &&
                    rect.width > 0 &&
                    rect.height > 0
                );
                """,
                element,
            )
        )
    except (JavascriptException, StaleElementReferenceException):
        return False


def get_visible_lines(driver: Chrome, element: WebElement) -> List[str]:
    try:
        text = driver.execute_script("return arguments[0].innerText || '';", element)
    except (JavascriptException, StaleElementReferenceException):
        return []

    raw_lines = str(text).splitlines()
    cleaned = []
    for line in raw_lines:
        normalized = normalize_whitespace(line)
        if not normalized:
            continue
        cleaned.append(normalized)
    return cleaned


def detect_active_page_number(driver: Chrome) -> Optional[int]:
    for selector in ACTIVE_PAGE_SELECTORS:
        try:
            candidates = driver.find_elements(By.CSS_SELECTOR, selector)
        except WebDriverException:
            continue

        for candidate in candidates:
            if not is_visible(driver, candidate):
                continue
            text = normalize_whitespace(candidate.text)
            if text.isdigit():
                return int(text)

    # Fallback: look for aria-current in the broader DOM via JavaScript.
    try:
        value = driver.execute_script(
            """
            const nodes = [...document.querySelectorAll('[aria-current], [aria-selected]')];
            for (const node of nodes) {
              const text = (node.innerText || node.textContent || '').trim();
              if (/^\\d+$/.test(text)) return Number(text);
            }
            return null;
            """
        )
        if isinstance(value, (int, float)):
            return int(value)
    except JavascriptException:
        pass

    return None


def validate_start_page(
    driver: Chrome,
    expected_page: int,
    debug_dir: Path,
    skip_validation: bool,
) -> None:
    active_page = detect_active_page_number(driver)
    if active_page is None:
        html_path, screenshot_path = dump_debug_artifacts(driver, debug_dir, "page_validation_failed")
        message = (
            "Could not detect the current page number from Modash pagination.\n"
            f"Expected page: {expected_page}\n"
            f"Debug HTML: {html_path}\n"
            f"Screenshot: {screenshot_path}\n"
            "If the browser is definitely on the right page, rerun with "
            "--skip-page-validation and then tune ACTIVE_PAGE_SELECTORS if needed."
        )
        if skip_validation:
            print(f"[warn] {message}")
            return
        raise SystemExit(message)

    if active_page != expected_page:
        raise SystemExit(
            f"Current Modash page appears to be {active_page}, "
            f"but you passed --start-page {expected_page}.\n"
            "Manually open the correct page in Chrome, then rerun."
        )

    print(f"[ok] Confirmed the browser is on page {active_page}.")


def find_handle_elements(driver: Chrome) -> List[WebElement]:
    elements = driver.find_elements(By.XPATH, HANDLE_XPATH)
    filtered: List[WebElement] = []

    for element in elements:
        if not is_visible(driver, element):
            continue
        text = normalize_whitespace(element.text)
        if not text.startswith("@"):
            continue
        if " " in text:
            continue
        if not HANDLE_PATTERN.fullmatch(text):
            continue
        filtered.append(element)

    return filtered


def find_row_container(driver: Chrome, handle_element: WebElement) -> Optional[WebElement]:
    try:
        container = driver.execute_script(
            """
            let node = arguments[0];
            for (let depth = 0; node && depth < 8; depth += 1) {
              const text = (node.innerText || '').trim();
              const hasHandle = /@[A-Za-z0-9._]+/.test(text);
              const hasView = /(^|\\n)View(\\n|$)/i.test(text);
              const numberMatches = text.match(/\\b\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?\\s*[kmb]?%?\\b/gi) || [];
              if (hasHandle && (hasView || numberMatches.length >= 2)) {
                return node;
              }
              node = node.parentElement;
            }
            return null;
            """,
            handle_element,
        )
        if isinstance(container, WebElement):
            return container
    except (JavascriptException, StaleElementReferenceException):
        return None

    return None


def unique_rows_from_handles(driver: Chrome, handle_elements: Iterable[WebElement]) -> List[WebElement]:
    seen_ids: set[str] = set()
    rows: List[WebElement] = []

    for handle_element in handle_elements:
        container = find_row_container(driver, handle_element)
        if container is None:
            continue
        row_id = getattr(container, "id", None)
        if not row_id or row_id in seen_ids:
            continue
        seen_ids.add(row_id)
        rows.append(container)

    return rows


def looks_like_metric(line: str) -> bool:
    return bool(PERCENT_PATTERN.fullmatch(line) or NUMERIC_TOKEN_PATTERN.fullmatch(line))


def infer_row_fields(lines: List[str], fallback_handle: str) -> tuple[str, str, str, str, str, str, str]:
    debug_notes: List[str] = []
    all_text = " | ".join(lines)

    handle = fallback_handle
    for line in lines:
        handle_match = HANDLE_PATTERN.search(line)
        if handle_match:
            handle = handle_match.group(0)
            break

    name = ""
    if handle in lines:
        handle_index = lines.index(handle)
        if handle_index > 0:
            name = lines[handle_index - 1]
        else:
            debug_notes.append("handle_was_first_line")
    else:
        for idx, line in enumerate(lines):
            if handle in line:
                if idx > 0:
                    name = lines[idx - 1]
                break

    percent_tokens = PERCENT_PATTERN.findall(all_text)
    numeric_tokens = [
        token.strip()
        for token in NUMERIC_TOKEN_PATTERN.findall(all_text)
        if token.strip() and not token.strip().endswith("%")
    ]

    followers = numeric_tokens[0] if numeric_tokens else ""
    er = percent_tokens[0] if percent_tokens else ""
    engagement = ""
    if er and followers and len(numeric_tokens) >= 2:
        engagement = numeric_tokens[1]
    elif len(numeric_tokens) >= 2:
        engagement = numeric_tokens[1]

    if not name:
        non_metric_lines = [
            line
            for line in lines
            if line not in {"View", handle}
            and not looks_like_metric(line)
            and not HANDLE_PATTERN.search(line)
        ]
        if non_metric_lines:
            name = non_metric_lines[0]
            debug_notes.append("name_inferred_from_first_non_metric_line")

    if not followers:
        debug_notes.append("followers_missing")
    if not er:
        debug_notes.append("er_missing")
    if not engagement:
        debug_notes.append("engagement_missing")

    return (
        name,
        handle,
        followers,
        er,
        engagement,
        json.dumps(numeric_tokens, ensure_ascii=True),
        json.dumps(percent_tokens, ensure_ascii=True),
        ",".join(debug_notes),
    )


def row_to_record(
    driver: Chrome,
    row_element: WebElement,
    page_number: int,
    row_number: int,
    scrape_timestamp: str,
) -> Optional[RowRecord]:
    row_lines = get_visible_lines(driver, row_element)
    row_lines = [line for line in row_lines if line.lower() != "view"]

    if not row_lines:
        return None

    fallback_handle = ""
    for line in row_lines:
        match = HANDLE_PATTERN.search(line)
        if match:
            fallback_handle = match.group(0)
            break

    if not fallback_handle:
        return None

    (
        inferred_name,
        inferred_handle,
        inferred_followers,
        inferred_er,
        inferred_engagement,
        numeric_tokens,
        percent_tokens,
        debug_notes,
    ) = infer_row_fields(row_lines, fallback_handle)

    line_slots = row_lines[:DEBUG_LINE_SLOTS]
    if len(line_slots) < DEBUG_LINE_SLOTS:
        line_slots.extend([""] * (DEBUG_LINE_SLOTS - len(line_slots)))

    return RowRecord(
        scrape_timestamp=scrape_timestamp,
        page_number=page_number,
        row_number=row_number,
        inferred_name=inferred_name,
        inferred_handle=inferred_handle,
        inferred_followers=inferred_followers,
        inferred_er=inferred_er,
        inferred_engagement=inferred_engagement,
        numeric_tokens=numeric_tokens,
        percent_tokens=percent_tokens,
        all_visible_text=" | ".join(row_lines),
        visible_lines_json=json.dumps(row_lines, ensure_ascii=True),
        debug_notes=debug_notes,
        line_slots=line_slots,
    )


def write_csv(csv_path: Path, records: List[RowRecord]) -> None:
    headers = [
        "scrape_timestamp",
        "page_number",
        "row_number",
        "inferred_name",
        "inferred_handle",
        "inferred_followers",
        "inferred_er",
        "inferred_engagement",
        "numeric_tokens",
        "percent_tokens",
        "all_visible_text",
        "visible_lines_json",
        "debug_notes",
    ] + [f"line_{idx}" for idx in range(1, DEBUG_LINE_SLOTS + 1)]

    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(headers)
        for record in records:
            writer.writerow(
                [
                    record.scrape_timestamp,
                    record.page_number,
                    record.row_number,
                    record.inferred_name,
                    record.inferred_handle,
                    record.inferred_followers,
                    record.inferred_er,
                    record.inferred_engagement,
                    record.numeric_tokens,
                    record.percent_tokens,
                    record.all_visible_text,
                    record.visible_lines_json,
                    record.debug_notes,
                    *record.line_slots,
                ]
            )


def get_next_button(driver: Chrome) -> Optional[WebElement]:
    for xpath in NEXT_BUTTON_XPATHS:
        try:
            candidates = driver.find_elements(By.XPATH, xpath)
        except WebDriverException:
            continue

        for candidate in candidates:
            if not is_visible(driver, candidate):
                continue

            aria_disabled = (candidate.get_attribute("aria-disabled") or "").lower()
            disabled = candidate.get_attribute("disabled")
            classes = (candidate.get_attribute("class") or "").lower()

            if aria_disabled == "true" or disabled is not None:
                return None
            if "disabled" in classes and "not-disabled" not in classes:
                return None
            return candidate

    return None


def click_next_and_wait(driver: Chrome, current_page: int, debug_dir: Path) -> bool:
    next_button = get_next_button(driver)
    if next_button is None:
        print("[done] No enabled Next button found. Assuming the last page has been reached.")
        return False

    try:
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", next_button)
        time.sleep(0.5)
        driver.execute_script("arguments[0].click();", next_button)
    except (JavascriptException, StaleElementReferenceException) as exc:
        html_path, screenshot_path = dump_debug_artifacts(driver, debug_dir, f"next_click_failed_p{current_page}")
        raise SystemExit(
            "Failed to click the Next button.\n"
            f"Debug HTML: {html_path}\n"
            f"Screenshot: {screenshot_path}\n"
            f"Original error: {exc}"
        ) from exc

    try:
        WebDriverWait(driver, 20).until(
            lambda d: (detect_active_page_number(d) or current_page) != current_page
        )
    except TimeoutException:
        # The page might still have advanced even if the active page selector is imperfect.
        print(
            "[warn] Timed out waiting for the active page number to change. "
            "Continuing after a short pause and saving debug artifacts."
        )
        dump_debug_artifacts(driver, debug_dir, f"page_change_timeout_after_{current_page}")
        time.sleep(3)

    wait_for_document_ready(driver)
    return True


def random_delay(min_delay: float, max_delay: float) -> float:
    return round(random.uniform(min_delay, max_delay), 2)


def scrape_current_page(
    driver: Chrome,
    page_number: int,
    debug_dir: Path,
) -> List[RowRecord]:
    wait_for_document_ready(driver)
    dump_debug_artifacts(driver, debug_dir, f"page_{page_number}")

    handle_elements = find_handle_elements(driver)
    row_elements = unique_rows_from_handles(driver, handle_elements)

    if not row_elements:
        html_path, screenshot_path = dump_debug_artifacts(driver, debug_dir, f"no_rows_found_page_{page_number}")
        raise SystemExit(
            f"No result rows were found on page {page_number}.\n"
            f"Debug HTML: {html_path}\n"
            f"Screenshot: {screenshot_path}\n"
            "This usually means HANDLE_XPATH or row-container detection needs tuning."
        )

    scrape_timestamp = datetime.now().isoformat(timespec="seconds")
    records: List[RowRecord] = []

    print(
        f"[info] Page {page_number}: found {len(handle_elements)} visible handles and "
        f"{len(row_elements)} unique row containers."
    )

    for idx, row_element in enumerate(row_elements, start=1):
        record = row_to_record(
            driver=driver,
            row_element=row_element,
            page_number=page_number,
            row_number=idx,
            scrape_timestamp=scrape_timestamp,
        )
        if record is None:
            print(f"[warn] Page {page_number}, row {idx}: skipped because no handle was inferred.")
            continue

        print(
            f"[row] p{page_number} r{idx} | "
            f"name={record.inferred_name!r} | "
            f"handle={record.inferred_handle!r} | "
            f"followers={record.inferred_followers!r} | "
            f"er={record.inferred_er!r} | "
            f"engagement={record.inferred_engagement!r}"
        )
        records.append(record)

    return records


def main() -> int:
    args = parse_args()

    if args.min_delay > args.max_delay:
        raise SystemExit("--min-delay cannot be greater than --max-delay.")

    output_dir, debug_dir = ensure_output_paths(Path(args.output_dir))
    run_slug = now_slug()
    csv_path = output_dir / f"modash_scrape_{run_slug}.csv"

    print(f"[info] Output CSV: {csv_path}")
    print(f"[info] Debug artifacts: {debug_dir}")

    driver = create_driver(args.debugger_address)
    try:
        wait_for_document_ready(driver)
        validate_start_page(
            driver=driver,
            expected_page=args.start_page,
            debug_dir=debug_dir,
            skip_validation=args.skip_page_validation,
        )

        all_records: List[RowRecord] = []
        current_page = args.start_page
        pages_scraped = 0

        while pages_scraped < args.max_pages:
            page_records = scrape_current_page(driver, current_page, debug_dir)
            all_records.extend(page_records)
            write_csv(csv_path, all_records)

            pages_scraped += 1
            print(
                f"[info] Saved {len(page_records)} rows from page {current_page}. "
                f"Running total: {len(all_records)} rows."
            )

            delay_seconds = random_delay(args.min_delay, args.max_delay)
            print(f"[info] Waiting {delay_seconds} seconds before moving on.")
            time.sleep(delay_seconds)

            moved = click_next_and_wait(driver, current_page, debug_dir)
            if not moved:
                break

            current_page += 1

        print(
            f"\n[done] Finished scraping.\n"
            f"Pages scraped: {pages_scraped}\n"
            f"Rows saved: {len(all_records)}\n"
            f"CSV: {csv_path}\n"
            f"Debug folder: {debug_dir}\n"
        )
        return 0
    finally:
        try:
            driver.quit()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main())
