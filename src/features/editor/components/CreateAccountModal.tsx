"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditorSelector } from "@/features/editor/store";
import { supabase } from "@/app/components/auth/AuthContext";

type StepId = 0 | 1 | 2 | 3;

const DEFAULT_AI_IMAGE_MODEL: "gpt-image-1.5" | "gemini-3-pro-image-preview" = "gpt-image-1.5";

// Pulled from the server implementation so new accounts never start blank.
const DEFAULT_IDEAS_PROMPT = `Review the social media post(s) in your knowledge base and extract {{topicCount}} topic ideas that would be interesting to an audience of {{audience}}.

Context:
- Source title: {{sourceTitle}}
- Source url: {{sourceUrl}}

For each topic, provide:
- A concise title
- 3–6 bullet groups. Each bullet group has:
  - a heading (e.g. "Key Point", "Business Impact", "Opportunity", "Action Item")
  - 1–3 short points

Do not write the carousel copy yet. Only identify topic ideas and their outlines.`;

// Pulled from the server implementation so new accounts never start blank.
const DEFAULT_CAPTION_REGEN_PROMPT = `COMPLETE CONTEXT FOR CAROUSEL CAPTION GENERATION
ABOUT THE USER
Business Identity:

Name: Ax
Business: "The Bottleneck Hunter"
Website: AutomatedBots.com
Positioning: AI automation consultant who applies Theory of Constraints methodology from Fortune 500 auditing background
Target Market: Post-product-market-fit companies ($1M-$20M revenue, 1-60 employees)
Core Service: Identify operational constraints BEFORE implementing AI solutions

Current Business Status:

Current MRR: ~$3K
Goal: $10K MRR
Recently landed: $9K client
Experience: 1+ year implementing AI for businesses
Background: Former Fortune 500 auditor (quit January 2025)

Key Differentiators:

Uses Theory of Constraints (TOC) methodology
Emphasizes constraint identification BEFORE tool selection
References "The Goal" by Eliyahu Goldratt
NOT a generic "AI automation consultant" - strategic business diagnostician first, implementer second

Technical Expertise:

n8n workflow development
Airtable automation
Cold email infrastructure (32 accounts across 8 domains via Instantly.ai)
Video production workflow automation
Quality control systems
API integrations

Content Infrastructure:

Creating 40 carousels per month
Platforms: LinkedIn and Instagram
Focus: Educational content about business constraints and operational efficiency


COPYWRITING FRAMEWORK (MANDATORY)
Every LinkedIn caption must follow this structure:

Open with intrigue/question - Hook that makes people stop scrolling
Establish credibility - Reference experience, specific results, or expertise
Show concrete pain - Real numbers, specific scenarios, actual costs
Inject constraint/bottleneck methodology - Always bring it back to finding constraints FIRST
Differentiate from generic automation consultants - "Here's what most consultants won't tell you..."
Reinforce "Bottleneck Hunter" brand - Use constraint/bottleneck language
Always emphasize finding constraint FIRST - Before any tool or solution
Conversational but professional tone - Not academic, not salesy


BRAND VOICE & TONE
Do:

Sound like a strategic advisor, not a vendor
Use short, punchy sentences
Include specific numbers and concrete examples
Lead with business outcomes, not technical features
Reference Fortune 500 audit methodology when relevant
Mention Theory of Constraints concepts naturally
Use phrases like: "constraint," "bottleneck," "what's actually slowing you down"

Don't:

Use fear-based manipulation ("automate or die")
Sound like generic AI hype
Lead with tools before diagnosis
Use excessive emojis or caps
Write like a growth hacker
Be overly academic or jargon-heavy
Apologize or hedge unnecessarily


KEY POSITIONING PRINCIPLES
Core Message:
"Find your constraint first. THEN decide if AI helps."
Against:

Tool-first thinking
"Shiny object" automation
Fear-based urgency
Blind AI adoption

For:

Strategic diagnosis before implementation
Stable, proven tools over bleeding-edge
Automating actual bottlenecks, not random tasks
Business constraints drive technology decisions


CAROUSEL SERIES FRAMEWORKS
Current Series:

"Mental Models" - Business frameworks applied to operations

Format: "Mental Models #[number]: [Framework Name]"
Example: "Mental Models #1: The Lindy Effect"


"Constraint-First Automation" - TOC applied to AI/automation

Format: "Constraint-First Automation #[number]: [Topic]"
Example: "Constraint-First Automation #1: The AI Application Gap"



EXAMPLE CLIENT STORIES (Use for credibility)

Law Firm:

Before: Paralegals spent 15 hrs/week on contract review
After: AI handles initial review in 45 minutes
Result: Team focuses on client strategy instead of document scanning


Metabolic Coach (Dr. Nick):

Before: 10 hours every Monday on client fulfillment
After: Custom web app + automation cut time to 3 hours
Result: Focus on client satisfaction instead of remedial tasks



CONTENT FILTERS (What NOT to create)
Red Flags - Don't Create Content That:

Says "automate or get left behind" without mentioning constraints
Focuses on AI capabilities without business context
Uses pure fear-based urgency
Positions automation as always the answer
Discusses tools without mentioning diagnosis first
Sounds like every other AI automation consultant

Green Lights - Do Create Content About:

Finding constraints before solutions
Real client transformation stories
Mental models applied to business operations
Why most automation fails (wrong constraint)
Strategic tool selection methodology
Theory of Constraints applications


CAPTION LENGTH OPTIONS
Long-form (primary):

1,500-2,000 characters
Follows full 8-step framework
Includes concrete example
Ends with question or clear CTA

Short-form (alternative):

Under 500 characters
Distills key message
Still maintains constraint-first positioning
Quick hook + insight + CTA


STANDARD CTA
Primary CTA:
"Let's have a chat.
AutomatedBots.com"


TECHNICAL CONTEXT (For understanding)
His Automation Stack:

n8n (workflow automation)
Airtable (database/automation)
Instantly.ai (cold email infrastructure)
Google Sheets (data processing)
Various APIs and integrations

His Targets (Lead Gen):

Solar companies
Engineering services
Video production companies
Post-PMF B2B companies`;

function isEmailLike(s: string) {
  const v = String(s || "").trim();
  if (!v) return false;
  // Light validation only (avoid being overly strict).
  return v.includes("@") && v.includes(".");
}

function safeTrim(s: string) {
  return String(s || "").replace(/\r\n/g, "\n").trim();
}

export function CreateAccountModal() {
  const open = useEditorSelector((s: any) => !!(s as any).createAccountModalOpen);
  const actions = useEditorSelector((s: any) => (s as any).actions);

  const [step, setStep] = useState<StepId>(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"idle" | "copied" | "error">("idle");
  const [busy, setBusy] = useState<boolean>(false);

  const [clientEmail, setClientEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [accountDisplayName, setAccountDisplayName] = useState("");

  const [poppyConversationUrl, setPoppyConversationUrl] = useState("");
  const [aiImageModel, setAiImageModel] = useState<"gpt-image-1.5" | "gemini-3-pro-image-preview">(DEFAULT_AI_IMAGE_MODEL);
  const [ideasPromptOverride, setIdeasPromptOverride] = useState(DEFAULT_IDEAS_PROMPT);
  const [captionRegenPromptOverride, setCaptionRegenPromptOverride] = useState(DEFAULT_CAPTION_REGEN_PROMPT);

  const [accountsLoading, setAccountsLoading] = useState<boolean>(false);
  const [availableAccounts, setAvailableAccounts] = useState<Array<{ accountId: string; displayName: string }>>([]);
  const [cloneDefaults, setCloneDefaults] = useState<boolean>(true);
  const [cloneFromAccountId, setCloneFromAccountId] = useState<string>("");

  const [emailLookupStatus, setEmailLookupStatus] = useState<"idle" | "checking" | "exists" | "missing" | "error">("idle");
  const [existingUserId, setExistingUserId] = useState<string | null>(null);

  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);
  const [createdExistingUser, setCreatedExistingUser] = useState<boolean>(false);
  const [createdAccountDisplayName, setCreatedAccountDisplayName] = useState<string>("");
  const [createdClonedTemplateCount, setCreatedClonedTemplateCount] = useState<number>(0);

  useEffect(() => {
    if (!open) return;
    // Phase 1: treat each open as a fresh session (no persistence yet).
    setStep(0);
    setError(null);
    setCopied("idle");
    setBusy(false);
    setClientEmail("");
    setPassword("");
    setConfirmPassword("");
    setAccountDisplayName("");
    setPoppyConversationUrl("");
    setAiImageModel(DEFAULT_AI_IMAGE_MODEL);
    setIdeasPromptOverride(DEFAULT_IDEAS_PROMPT);
    setCaptionRegenPromptOverride(DEFAULT_CAPTION_REGEN_PROMPT);
    setAccountsLoading(false);
    setAvailableAccounts([]);
    setCloneDefaults(true);
    setCloneFromAccountId("");
    setEmailLookupStatus("idle");
    setExistingUserId(null);
    setCreatedAccountId(null);
    setCreatedExistingUser(false);
    setCreatedAccountDisplayName("");
    setCreatedClonedTemplateCount(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadAccounts() {
      setAccountsLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token || "";
        if (!token) {
          if (cancelled) return;
          setAvailableAccounts([]);
          setAccountsLoading(false);
          return;
        }

        const rawActive = (() => {
          try {
            return typeof localStorage !== "undefined" ? String(localStorage.getItem("editor.activeAccountId") || "").trim() : "";
          } catch {
            return "";
          }
        })();

        const res = await fetch("/api/editor/accounts/me", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(rawActive ? { "x-account-id": rawActive } : {}),
          },
        });
        const j = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !j?.success) {
          setAvailableAccounts([]);
          setAccountsLoading(false);
          return;
        }
        const accts = Array.isArray(j.accounts) ? j.accounts : [];
        const next = accts
          .map((a: any) => ({ accountId: String(a?.accountId || "").trim(), displayName: String(a?.displayName || "").trim() }))
          .filter((a: any) => a.accountId && a.displayName);
        setAvailableAccounts(next);
        setAccountsLoading(false);

        const defaultSource = rawActive && next.some((a: any) => a.accountId === rawActive) ? rawActive : next[0]?.accountId || "";
        setCloneFromAccountId(defaultSource);
      } catch {
        if (cancelled) return;
        setAvailableAccounts([]);
        setAccountsLoading(false);
      }
    }
    void loadAccounts();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const onboardingMessage = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const loginUrl = origin ? `${origin}/editor` : "/editor";
    const passwordLine = createdExistingUser
      ? `Password: (use your existing password — we did not change it)`
      : `Password: ${password}`; // per your requirement: include password you set
    return [
      `Your carousel editor account is ready.`,
      ``,
      `Login: ${loginUrl}`,
      `Email: ${safeTrim(clientEmail)}`,
      passwordLine,
      ``,
      `If you have any trouble logging in, reply here and I'll help.`,
    ].join("\n");
  }, [clientEmail, createdExistingUser, password]);

  const editingLocked = busy || !!createdAccountId;

  const canGoNext = useMemo(() => {
    if (step === 0) {
      if (!isEmailLike(clientEmail)) return false;
      if (emailLookupStatus === "exists") return true;
      if (!safeTrim(password)) return false;
      if (password !== confirmPassword) return false;
      return true;
    }
    if (step === 1) {
      return !!safeTrim(accountDisplayName);
    }
    if (step === 2) {
      return !!safeTrim(poppyConversationUrl);
    }
    return true;
  }, [accountDisplayName, clientEmail, confirmPassword, password, poppyConversationUrl, step]);

  if (!open) return null;

  const close = () => {
    if (busy) return;
    actions?.onCloseCreateAccountModal?.();
  };

  const lookupEmail = async () => {
    const email = safeTrim(clientEmail).toLowerCase();
    if (!isEmailLike(email)) return;
    setEmailLookupStatus("checking");
    setExistingUserId(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || "";
      if (!token) {
        setEmailLookupStatus("error");
        return;
      }
      const res = await fetch("/api/editor/accounts/lookup-user", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) {
        setEmailLookupStatus("error");
        return;
      }
      const exists = !!j.exists;
      setExistingUserId(j.userId ? String(j.userId) : null);
      setEmailLookupStatus(exists ? "exists" : "missing");
    } catch {
      setEmailLookupStatus("error");
    }
  };

  const onNext = () => {
    setError(null);
    if (!canGoNext) {
      setError("Please complete the required fields before continuing.");
      return;
    }
    if (step === 0) setStep(1);
    else if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
  };

  const onBack = () => {
    setError(null);
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
    else if (step === 1) setStep(0);
  };

  const onCopy = async () => {
    try {
      setCopied("idle");
      await navigator.clipboard.writeText(onboardingMessage);
      setCopied("copied");
      window.setTimeout(() => setCopied("idle"), 1200);
    } catch {
      setCopied("error");
      window.setTimeout(() => setCopied("idle"), 1500);
    }
  };

  const onCreate = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || "";
      if (!token) {
        setError("Not authenticated.");
        setBusy(false);
        return;
      }
      const res = await fetch("/api/editor/accounts/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: safeTrim(clientEmail),
          password: emailLookupStatus === "exists" ? null : password,
          accountDisplayName: safeTrim(accountDisplayName),
          poppyConversationUrl: safeTrim(poppyConversationUrl),
          aiImageGenModel: aiImageModel,
          ideasPromptOverride,
          captionRegenPromptOverride,
          cloneDefaults,
          cloneFromAccountId: cloneDefaults ? safeTrim(cloneFromAccountId) : null,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) {
        setError(String(j?.error || "Failed to create account"));
        setBusy(false);
        return;
      }
      setCreatedAccountId(String(j.accountId || ""));
      setCreatedExistingUser(!!j.existingUser);
      setCreatedAccountDisplayName(String(j.accountDisplayName || ""));
      setCreatedClonedTemplateCount(Number(j.clonedTemplateCount || 0));
      setBusy(false);
    } catch (e: any) {
      setError(String(e?.message || "Failed to create account"));
      setBusy(false);
    }
  };

  const onSwitchToNewAccount = () => {
    if (!createdAccountId) return;
    try {
      localStorage.setItem("editor.activeAccountId", createdAccountId);
    } catch {
      // ignore
    }
    window.location.reload();
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="text-base font-semibold text-slate-900">Create Client Account</div>
          <button
            type="button"
            className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={close}
            disabled={busy}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 max-h-[80vh] overflow-y-auto">
          {/* Stepper */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4">
            {[
              { id: 0 as const, label: "Client Login" },
              { id: 1 as const, label: "Workspace" },
              { id: 2 as const, label: "Account Settings" },
              { id: 3 as const, label: "Review" },
            ].map((s) => {
              const active = s.id === step;
              const done = s.id < step;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={[
                    "h-9 px-3 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors",
                    active
                      ? "bg-slate-900 text-white border-slate-900"
                      : done
                        ? "bg-white text-slate-900 border-slate-300 hover:bg-slate-50"
                        : "bg-white text-slate-500 border-slate-200",
                  ].join(" ")}
                  onClick={() => {
                    // Allow backwards navigation only (Phase 1: no partial submit).
                    if (busy) return;
                    if (createdAccountId) return;
                    if (s.id <= step) setStep(s.id);
                  }}
                  disabled={busy || !!createdAccountId}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {step === 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {emailLookupStatus === "exists" ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Existing user found — will attach as <span className="font-semibold">Owner</span>. Password fields will be ignored.
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  Tip: If the email already exists, we’ll attach the existing user as <span className="font-semibold">Owner</span>. Password fields will be ignored.
                </div>
              )}

              <div>
                <div className="text-sm font-semibold text-slate-900">Client Email</div>
                <input
                  className="mt-2 w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  onBlur={() => void lookupEmail()}
                  placeholder="client@email.com"
                  disabled={editingLocked}
                />
                <div className="mt-1 text-xs text-slate-500">
                  {emailLookupStatus === "checking"
                    ? "Checking email…"
                    : emailLookupStatus === "exists"
                      ? "Existing user ✓"
                      : emailLookupStatus === "missing"
                        ? "New user"
                        : emailLookupStatus === "error"
                          ? "Couldn’t check email (will still validate on create)"
                          : null}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Set Password</div>
                  <input
                    className="mt-2 w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    type="password"
                    disabled={editingLocked}
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Confirm Password</div>
                  <input
                    className="mt-2 w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    type="password"
                    disabled={editingLocked}
                  />
                  {emailLookupStatus !== "exists" && safeTrim(confirmPassword) && password !== confirmPassword ? (
                    <div className="mt-1 text-xs text-red-600">Passwords do not match.</div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Account Display Name</div>
                <div className="mt-0.5 text-xs text-slate-500">Example: Mike (Client)</div>
                <input
                  className="mt-2 w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
                  value={accountDisplayName}
                  onChange={(e) => setAccountDisplayName(e.target.value)}
                  placeholder="ClientName (Client)"
                  disabled={editingLocked}
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-800">Clone default templates + mappings</div>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={cloneDefaults} onChange={(e) => setCloneDefaults(e.target.checked)} />
                    <span>Enable</span>
                  </label>
                </div>
                <div className="mt-1 text-slate-600">
                  Clones only the <span className="font-semibold">Regular</span> and <span className="font-semibold">Enhanced</span>{" "}
                  `carousel_template_type_overrides` rows and their 6 referenced `carousel_templates` (not a full template library clone).
                </div>
                {cloneDefaults ? (
                  <div className="mt-2">
                    <div className="text-xs font-semibold text-slate-700">Clone from account</div>
                    <select
                      className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
                      value={cloneFromAccountId}
                      disabled={editingLocked || accountsLoading || availableAccounts.length === 0}
                      onChange={(e) => setCloneFromAccountId(String(e.target.value || ""))}
                    >
                      {availableAccounts.map((a) => (
                        <option key={a.accountId} value={a.accountId}>
                          {a.displayName}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {accountsLoading ? "Loading accounts…" : availableAccounts.length === 0 ? "No accounts available." : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Poppy Conversation URL</div>
                <div className="mt-0.5 text-xs text-slate-500">Required for Generate Copy / Generate Ideas.</div>
                <input
                  className="mt-2 w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
                  value={poppyConversationUrl}
                  onChange={(e) => setPoppyConversationUrl(e.target.value)}
                  placeholder="https://api.getpoppy.ai/api/conversation?board_id=...&chat_id=...&model=..."
                  disabled={editingLocked}
                />
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900">AI Image Model</div>
                <select
                  className="mt-2 w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
                  value={aiImageModel}
                  onChange={(e) => {
                    const v = String(e.target.value || "").trim();
                    setAiImageModel(v === "gemini-3-pro-image-preview" ? "gemini-3-pro-image-preview" : "gpt-image-1.5");
                  }}
                  disabled={editingLocked}
                >
                  <option value="gpt-image-1.5">GPT Image (gpt-image-1.5)</option>
                  <option value="gemini-3-pro-image-preview">Gemini 3 Pro (gemini-3-pro-image-preview)</option>
                </select>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900">Ideas Prompt Override</div>
                <div className="mt-0.5 text-xs text-slate-500">Pre-filled with the current default (editable).</div>
                <textarea
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                  rows={10}
                  value={ideasPromptOverride}
                  onChange={(e) => setIdeasPromptOverride(e.target.value)}
                  disabled={editingLocked}
                />
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900">Caption Regen Prompt Override</div>
                <div className="mt-0.5 text-xs text-slate-500">Pre-filled with the current default (editable).</div>
                <textarea
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                  rows={10}
                  value={captionRegenPromptOverride}
                  onChange={(e) => setCaptionRegenPromptOverride(e.target.value)}
                  disabled={editingLocked}
                />
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid grid-cols-1 gap-4">
              {createdAccountId ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
                  ✅ Account created. {createdExistingUser ? "Existing user attached as Owner." : "New user created and attached as Owner."}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  Review everything, then click <span className="font-semibold">Create Account</span>.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-sm font-semibold text-slate-900">Summary</div>
                  <div className="mt-2 text-xs text-slate-700 space-y-1">
                    <div><span className="font-semibold">Client email:</span> {safeTrim(clientEmail) || "—"}</div>
                    <div>
                      <span className="font-semibold">Account name:</span>{" "}
                      {createdAccountDisplayName ? createdAccountDisplayName : safeTrim(accountDisplayName) || "—"}
                    </div>
                    <div><span className="font-semibold">Poppy URL:</span> {safeTrim(poppyConversationUrl) ? "Set ✓" : "Missing"}</div>
                    <div><span className="font-semibold">AI image model:</span> {aiImageModel}</div>
                    <div><span className="font-semibold">Clone defaults:</span> {cloneDefaults ? "Yes" : "No"}</div>
                    {cloneDefaults ? (
                      <div><span className="font-semibold">Clone from:</span> {cloneFromAccountId || "—"}</div>
                    ) : null}
                    {createdAccountId ? (
                      <div><span className="font-semibold">New account id:</span> {createdAccountId}</div>
                    ) : null}
                    {createdAccountId && cloneDefaults ? (
                      <div><span className="font-semibold">Templates cloned:</span> {createdClonedTemplateCount}</div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">Copy onboarding message</div>
                    <button
                      type="button"
                      className="h-9 px-3 rounded-md bg-slate-900 text-white text-sm shadow-sm disabled:opacity-50"
                      onClick={onCopy}
                      disabled={!safeTrim(clientEmail) || (!safeTrim(password) && !createdExistingUser)}
                      title="Copy message to clipboard"
                    >
                      {copied === "copied" ? "Copied ✓" : copied === "error" ? "Copy failed" : "Copy"}
                    </button>
                  </div>
                  <textarea
                    className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900 font-mono text-xs"
                    rows={10}
                    readOnly
                    value={onboardingMessage}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {error ? <div className="mt-4 text-sm text-red-600">❌ {error}</div> : null}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            {step === 0 ? "Step 1/4" : step === 1 ? "Step 2/4" : step === 2 ? "Step 3/4" : "Step 4/4"}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm shadow-sm disabled:opacity-50"
              onClick={onBack}
              disabled={step === 0 || busy}
            >
              Back
            </button>
            {step < 3 ? (
              <button
                type="button"
                className="h-9 px-3 rounded-md bg-slate-900 text-white text-sm shadow-sm disabled:opacity-50"
                onClick={onNext}
                disabled={!canGoNext || busy}
              >
                Next
              </button>
            ) : (
              <>
                {createdAccountId ? (
                  <button
                    type="button"
                    className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm shadow-sm"
                    onClick={onSwitchToNewAccount}
                    title="Switch the editor to the new account"
                  >
                    Switch to Account
                  </button>
                ) : null}
                <button
                  type="button"
                  className="h-9 px-3 rounded-md bg-slate-900 text-white text-sm shadow-sm disabled:opacity-50"
                  onClick={() => void onCreate()}
                  disabled={busy || !!createdAccountId}
                >
                  {createdAccountId ? "Created ✓" : busy ? "Creating…" : "Create Account"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

