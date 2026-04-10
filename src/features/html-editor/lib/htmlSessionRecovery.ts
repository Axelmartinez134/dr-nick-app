"use client";

import type { HtmlEditorSnapshot } from "./htmlEditorSnapshots";

const HTML_EDITOR_SESSION_KEY_PREFIX = "html-editor.session";

export function getHtmlEditorActiveAccountId() {
  try {
    const value = typeof localStorage !== "undefined" ? String(localStorage.getItem("editor.activeAccountId") || "").trim() : "";
    return value || "default";
  } catch {
    return "default";
  }
}

function getSessionStorageKey(projectId: string, accountId: string) {
  return `${HTML_EDITOR_SESSION_KEY_PREFIX}.${String(accountId || "default").trim()}.${String(projectId || "").trim()}`;
}

export function readHtmlSessionDraft(projectId: string, accountId: string): HtmlEditorSnapshot | null {
  const safeProjectId = String(projectId || "").trim();
  const safeAccountId = String(accountId || "").trim() || "default";
  if (!safeProjectId) return null;
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(getSessionStorageKey(safeProjectId, safeAccountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HtmlEditorSnapshot | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (String(parsed.projectId || "").trim() !== safeProjectId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeHtmlSessionDraft(snapshot: HtmlEditorSnapshot) {
  const projectId = String(snapshot?.projectId || "").trim();
  const accountId = String(snapshot?.accountId || "").trim() || "default";
  if (!projectId) return;
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(getSessionStorageKey(projectId, accountId), JSON.stringify(snapshot));
  } catch {
    // ignore storage failures
  }
}

export function clearHtmlSessionDraft(projectId: string, accountId: string) {
  const safeProjectId = String(projectId || "").trim();
  const safeAccountId = String(accountId || "").trim() || "default";
  if (!safeProjectId) return;
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(getSessionStorageKey(safeProjectId, safeAccountId));
  } catch {
    // ignore storage failures
  }
}
