export type HtmlPresetTemplateRole = "cover" | "content" | "cta";

export type HtmlPresetStyleGuide = {
  fontFamily: string;
  headingFontFamily: string;
  bodyFontFamily: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  designPatterns: string[];
};

export type HtmlPresetTemplate = {
  id: string;
  name: string;
  role: HtmlPresetTemplateRole;
  html: string;
};

export type HtmlDesignPreset = {
  id: string;
  name: string;
  description: string;
  aspectRatio: "3:4";
  category: string;
  isFeatured: boolean;
  exampleImages: string[];
  templates: HtmlPresetTemplate[];
  styleGuide: HtmlPresetStyleGuide;
};

export const SYSTEM_HTML_PRESETS: HtmlDesignPreset[] = [
  {
    id: "c9a7f790-7dd6-4e50-bc9f-8de3c1f90001",
    name: "Executive Contrast",
    description: "Dark editorial business layouts with strong contrast and bold callouts.",
    aspectRatio: "3:4",
    category: "business",
    isFeatured: true,
    exampleImages: [],
    styleGuide: {
      fontFamily: "Inter",
      headingFontFamily: "Inter",
      bodyFontFamily: "Inter",
      primaryColor: "#0F172A",
      secondaryColor: "#E2E8F0",
      accentColor: "#38BDF8",
      backgroundColor: "#020617",
      designPatterns: ["editorial contrast", "bold labels", "high-density typography"],
    },
    templates: [
      {
        id: "executive-contrast-cover",
        name: "Executive Contrast Cover",
        role: "cover",
        html: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap"><div style="width:1080px;height:1440px;overflow:hidden;position:relative;background:#020617;color:#e2e8f0;padding:88px;display:flex;flex-direction:column;justify-content:space-between;font-family:'Inter',sans-serif;"><div style="display:inline-flex;align-items:center;gap:12px;font-size:28px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#38bdf8;">Dr Nick</div><div style="font-size:110px;line-height:0.94;font-weight:800;max-width:760px;">Statement headline.</div><div style="display:flex;justify-content:space-between;align-items:flex-end;"><div style="font-size:30px;line-height:1.4;max-width:540px;color:#cbd5e1;">Supporting line.</div><div class="image-slot" data-slot-id="exec-cover-slot" data-slot-type="main" data-slot-label="Accent image" data-search-query="abstract business editorial" style="width:260px;height:260px;border-radius:40px;background:linear-gradient(135deg,#38bdf8,#1d4ed8);"></div></div></div>`,
      },
      {
        id: "executive-contrast-content",
        name: "Executive Contrast Content",
        role: "content",
        html: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap"><div style="width:1080px;height:1440px;overflow:hidden;position:relative;background:#0f172a;color:#f8fafc;padding:80px;display:grid;grid-template-columns:1.2fr 0.8fr;gap:40px;font-family:'Inter',sans-serif;"><div style="display:flex;flex-direction:column;gap:26px;"><div style="font-size:28px;letter-spacing:0.22em;text-transform:uppercase;color:#38bdf8;font-weight:700;">Insight</div><div style="font-size:74px;line-height:1;font-weight:800;">Key point</div><div style="font-size:32px;line-height:1.45;color:#cbd5e1;">Supporting bullets.</div></div><div style="display:flex;align-items:flex-end;justify-content:flex-end;"><div class="image-slot" data-slot-id="exec-content-slot" data-slot-type="main" data-slot-label="Main image" data-search-query="modern business portrait" style="width:100%;height:620px;border-radius:44px;background:linear-gradient(160deg,#1e293b,#38bdf8);"></div></div></div>`,
      },
    ],
  },
  {
    id: "c9a7f790-7dd6-4e50-bc9f-8de3c1f90002",
    name: "Soft Authority",
    description: "Warm, airy educational slides with rounded cards and calm backgrounds.",
    aspectRatio: "3:4",
    category: "education",
    isFeatured: true,
    exampleImages: [],
    styleGuide: {
      fontFamily: "DM Sans",
      headingFontFamily: "DM Sans",
      bodyFontFamily: "DM Sans",
      primaryColor: "#1F2937",
      secondaryColor: "#FFF7ED",
      accentColor: "#F97316",
      backgroundColor: "#FFFBEB",
      designPatterns: ["soft cards", "friendly education", "warm accent chips"],
    },
    templates: [
      {
        id: "soft-authority-cover",
        name: "Soft Authority Cover",
        role: "cover",
        html: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&display=swap"><div style="width:1080px;height:1440px;overflow:hidden;position:relative;background:#fff7ed;color:#1f2937;padding:86px;font-family:'DM Sans',sans-serif;"><div style="position:absolute;inset:0;background:radial-gradient(circle at top right,rgba(249,115,22,0.18),transparent 34%),radial-gradient(circle at bottom left,rgba(251,191,36,0.18),transparent 36%);"></div><div style="position:relative;display:flex;flex-direction:column;height:100%;justify-content:space-between;"><div style="display:inline-flex;align-items:center;border:2px solid rgba(249,115,22,0.25);border-radius:999px;padding:12px 20px;font-size:28px;font-weight:700;color:#f97316;background:rgba(255,255,255,0.8);width:max-content;">Practical breakdown</div><div style="display:flex;flex-direction:column;gap:24px;"><div style="font-size:102px;line-height:0.94;font-weight:800;max-width:820px;">Topic headline.</div><div style="font-size:34px;line-height:1.45;max-width:660px;color:#4b5563;">Subhead line.</div></div><div style="display:flex;justify-content:space-between;align-items:flex-end;"><div style="width:220px;height:220px;border-radius:36px;background:linear-gradient(135deg,#fb923c,#fdba74);opacity:0.95;"></div><div class="image-slot" data-slot-id="soft-authority-cover-slot" data-slot-type="logo" data-slot-label="Brand mark" style="width:180px;height:90px;border-radius:28px;background:rgba(255,255,255,0.85);border:1px solid rgba(249,115,22,0.18);"></div></div></div></div>`,
      },
      {
        id: "soft-authority-content",
        name: "Soft Authority Content",
        role: "content",
        html: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&display=swap"><div style="width:1080px;height:1440px;overflow:hidden;position:relative;background:#fffbeb;color:#1f2937;padding:72px;font-family:'DM Sans',sans-serif;display:flex;flex-direction:column;gap:28px;"><div style="display:flex;gap:24px;align-items:center;"><div style="width:92px;height:92px;border-radius:30px;background:#f97316;"></div><div style="font-size:78px;line-height:1;font-weight:800;max-width:760px;">Section title</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;flex:1;"><div style="border-radius:36px;background:white;padding:36px;box-shadow:0 18px 45px rgba(15,23,42,0.08);font-size:31px;line-height:1.5;color:#374151;">Point one.</div><div style="border-radius:36px;background:white;padding:36px;box-shadow:0 18px 45px rgba(15,23,42,0.08);font-size:31px;line-height:1.5;color:#374151;">Point two.</div><div style="grid-column:1 / -1;border-radius:42px;background:#fff;padding:40px;display:flex;gap:30px;align-items:center;"><div class="image-slot" data-slot-id="soft-content-slot" data-slot-type="main" data-slot-label="Supporting visual" data-search-query="calm educational illustration" style="width:290px;height:290px;border-radius:34px;background:linear-gradient(160deg,#fdba74,#fb923c);flex-shrink:0;"></div><div style="font-size:34px;line-height:1.5;color:#374151;">Closing explanation.</div></div></div></div>`,
      },
    ],
  },
  {
    id: "c9a7f790-7dd6-4e50-bc9f-8de3c1f90003",
    name: "Neon Strategy",
    description: "High-energy tech slides with dark gradients and vibrant accent blocks.",
    aspectRatio: "3:4",
    category: "tech",
    isFeatured: false,
    exampleImages: [],
    styleGuide: {
      fontFamily: "Space Grotesk",
      headingFontFamily: "Space Grotesk",
      bodyFontFamily: "Inter",
      primaryColor: "#020617",
      secondaryColor: "#F8FAFC",
      accentColor: "#A855F7",
      backgroundColor: "#0F172A",
      designPatterns: ["neon gradient", "grid overlays", "tech punch cards"],
    },
    templates: [
      {
        id: "neon-strategy-cover",
        name: "Neon Strategy Cover",
        role: "cover",
        html: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap"><div style="width:1080px;height:1440px;overflow:hidden;position:relative;background:radial-gradient(circle at top right,#7c3aed,transparent 30%),radial-gradient(circle at bottom left,#06b6d4,transparent 30%),#020617;color:#f8fafc;padding:82px;font-family:'Inter',sans-serif;"><div style="position:absolute;inset:0;background-image:linear-gradient(rgba(148,163,184,0.12) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.12) 1px,transparent 1px);background-size:60px 60px;opacity:0.35;"></div><div style="position:relative;height:100%;display:flex;flex-direction:column;justify-content:space-between;"><div style="font-size:28px;letter-spacing:0.26em;text-transform:uppercase;color:#22d3ee;font-weight:700;">Systems memo</div><div style="display:flex;flex-direction:column;gap:24px;"><div style="font-family:'Space Grotesk',sans-serif;font-size:108px;line-height:0.92;font-weight:700;max-width:800px;">Sharp claim goes here.</div><div style="font-size:32px;line-height:1.5;max-width:640px;color:#cbd5e1;">Support line.</div></div><div style="display:flex;gap:18px;align-items:center;"><div class="image-slot" data-slot-id="neon-cover-slot" data-slot-type="main" data-slot-label="Tech visual" data-search-query="futuristic dashboard abstract" style="width:320px;height:210px;border-radius:32px;background:linear-gradient(135deg,#0ea5e9,#a855f7);box-shadow:0 20px 60px rgba(14,165,233,0.35);"></div><div style="font-family:'Space Grotesk',sans-serif;font-size:24px;color:#93c5fd;">Built for bold, information-dense storytelling.</div></div></div></div>`,
      },
      {
        id: "neon-strategy-content",
        name: "Neon Strategy Content",
        role: "content",
        html: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap"><div style="width:1080px;height:1440px;overflow:hidden;position:relative;background:#020617;color:#f8fafc;padding:80px;display:flex;flex-direction:column;gap:28px;font-family:'Inter',sans-serif;"><div style="display:flex;justify-content:space-between;gap:24px;align-items:flex-start;"><div style="font-family:'Space Grotesk',sans-serif;font-size:78px;line-height:0.98;font-weight:700;max-width:640px;">Signal and takeaway</div><div style="border:1px solid rgba(34,211,238,0.4);border-radius:999px;padding:12px 18px;font-size:24px;color:#22d3ee;">Tech</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:22px;flex:1;"><div style="border-radius:34px;background:rgba(15,23,42,0.72);border:1px solid rgba(168,85,247,0.24);padding:34px;font-size:30px;line-height:1.45;color:#cbd5e1;">Insight block.</div><div style="border-radius:34px;background:rgba(15,23,42,0.72);border:1px solid rgba(34,211,238,0.24);padding:34px;font-size:30px;line-height:1.45;color:#cbd5e1;">Insight block.</div><div style="grid-column:1 / -1;display:flex;gap:28px;align-items:stretch;"><div class="image-slot" data-slot-id="neon-content-slot" data-slot-type="background" data-slot-label="Ambient visual" data-search-query="glowing grid mesh" style="width:38%;border-radius:34px;background:linear-gradient(160deg,#1d4ed8,#7c3aed,#22d3ee);"></div><div style="flex:1;border-radius:34px;background:rgba(15,23,42,0.82);border:1px solid rgba(148,163,184,0.18);padding:38px;font-size:32px;line-height:1.5;color:#e2e8f0;">Closer text.</div></div></div></div>`,
      },
    ],
  },
  {
    id: "c9a7f790-7dd6-4e50-bc9f-8de3c1f90004",
    name: "Minimal Ledger",
    description: "Minimal monochrome layouts with clean alignment and subtle structure.",
    aspectRatio: "3:4",
    category: "marketing",
    isFeatured: false,
    exampleImages: [],
    styleGuide: {
      fontFamily: "IBM Plex Sans",
      headingFontFamily: "IBM Plex Sans",
      bodyFontFamily: "IBM Plex Sans",
      primaryColor: "#111827",
      secondaryColor: "#F9FAFB",
      accentColor: "#111827",
      backgroundColor: "#FFFFFF",
      designPatterns: ["minimal rules", "mono labels", "precise spacing"],
    },
    templates: [
      {
        id: "minimal-ledger-cover",
        name: "Minimal Ledger Cover",
        role: "cover",
        html: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;700&display=swap"><div style="width:1080px;height:1440px;overflow:hidden;position:relative;background:white;color:#111827;padding:84px;font-family:'IBM Plex Sans',sans-serif;display:flex;flex-direction:column;justify-content:space-between;"><div style="display:flex;justify-content:space-between;align-items:center;"><div style="font-size:26px;letter-spacing:0.28em;text-transform:uppercase;color:#6b7280;">Issue</div><div style="width:180px;height:2px;background:#111827;"></div></div><div style="font-size:108px;line-height:0.93;font-weight:700;max-width:820px;">Clean headline.</div><div style="display:grid;grid-template-columns:1fr auto;gap:28px;align-items:end;"><div style="font-size:32px;line-height:1.5;color:#4b5563;max-width:620px;">Supporting line.</div><div class="image-slot" data-slot-id="minimal-ledger-slot" data-slot-type="logo" data-slot-label="Logo" style="width:170px;height:80px;border:2px solid #111827;border-radius:20px;"></div></div></div>`,
      },
      {
        id: "minimal-ledger-content",
        name: "Minimal Ledger Content",
        role: "content",
        html: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;700&display=swap"><div style="width:1080px;height:1440px;overflow:hidden;position:relative;background:#f9fafb;color:#111827;padding:76px;font-family:'IBM Plex Sans',sans-serif;display:flex;flex-direction:column;gap:28px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;"><div style="font-size:78px;line-height:0.98;font-weight:700;max-width:700px;">Measured section title</div><div style="font-size:22px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">01</div></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;flex:1;"><div style="border:2px solid #111827;background:white;border-radius:28px;padding:28px;font-size:30px;line-height:1.5;">Bullet block.</div><div style="border:2px solid #111827;background:white;border-radius:28px;padding:28px;font-size:30px;line-height:1.5;">Bullet block.</div><div style="grid-column:1 / -1;border:2px solid #111827;background:white;border-radius:28px;padding:30px;display:flex;gap:28px;align-items:center;"><div class="image-slot" data-slot-id="minimal-content-slot" data-slot-type="main" data-slot-label="Reference image" data-search-query="clean monochrome portrait" style="width:240px;height:240px;border-radius:22px;background:linear-gradient(135deg,#d1d5db,#9ca3af);flex-shrink:0;"></div><div style="font-size:32px;line-height:1.5;color:#374151;">Clarifying explanation.</div></div></div></div>`,
      },
    ],
  },
  {
    id: "c9a7f790-7dd6-4e50-bc9f-8de3c1f90005",
    name: "Playbook Grid",
    description: "Structured playbook slides with modular panels and strong call-to-action endings.",
    aspectRatio: "3:4",
    category: "marketing",
    isFeatured: true,
    exampleImages: [],
    styleGuide: {
      fontFamily: "Manrope",
      headingFontFamily: "Manrope",
      bodyFontFamily: "Manrope",
      primaryColor: "#111827",
      secondaryColor: "#ECFEFF",
      accentColor: "#14B8A6",
      backgroundColor: "#F0FDFA",
      designPatterns: ["structured grid", "teal accent blocks", "playbook sequencing"],
    },
    templates: [
      {
        id: "playbook-grid-cover",
        name: "Playbook Grid Cover",
        role: "cover",
        html: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap"><div style="width:1080px;height:1440px;overflow:hidden;position:relative;background:#f0fdfa;color:#111827;padding:78px;font-family:'Manrope',sans-serif;display:flex;flex-direction:column;gap:30px;"><div style="display:grid;grid-template-columns:1fr auto;gap:20px;align-items:start;"><div style="display:inline-flex;align-items:center;gap:12px;font-size:24px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:0.18em;">Playbook</div><div style="width:120px;height:120px;border-radius:28px;background:#14b8a6;"></div></div><div style="font-size:98px;line-height:0.94;font-weight:800;max-width:840px;">Framework headline.</div><div style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:24px;flex:1;"><div style="border-radius:34px;background:white;padding:34px;box-shadow:0 18px 42px rgba(17,24,39,0.08);font-size:32px;line-height:1.45;color:#374151;">Preview line.</div><div class="image-slot" data-slot-id="playbook-cover-slot" data-slot-type="main" data-slot-label="Hero visual" data-search-query="marketing strategy desk" style="border-radius:34px;background:linear-gradient(135deg,#0f766e,#5eead4);"></div></div></div>`,
      },
      {
        id: "playbook-grid-cta",
        name: "Playbook Grid CTA",
        role: "cta",
        html: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap"><div style="width:1080px;height:1440px;overflow:hidden;position:relative;background:#111827;color:#f8fafc;padding:78px;font-family:'Manrope',sans-serif;display:flex;flex-direction:column;justify-content:space-between;"><div style="display:flex;justify-content:space-between;align-items:flex-start;"><div style="font-size:26px;letter-spacing:0.22em;text-transform:uppercase;color:#5eead4;">Next step</div><div style="border-radius:999px;border:1px solid rgba(94,234,212,0.45);padding:10px 16px;font-size:22px;color:#5eead4;">CTA</div></div><div style="display:flex;flex-direction:column;gap:28px;"><div style="font-size:92px;line-height:0.95;font-weight:800;max-width:760px;">Closing action.</div><div style="font-size:34px;line-height:1.5;max-width:660px;color:#cbd5e1;">Final push line.</div></div><div style="display:grid;grid-template-columns:1fr auto;gap:26px;align-items:end;"><div style="display:flex;gap:14px;flex-wrap:wrap;"> <div style="border-radius:999px;background:rgba(94,234,212,0.12);padding:14px 18px;font-size:22px;color:#ccfbf1;">Step 1</div><div style="border-radius:999px;background:rgba(94,234,212,0.12);padding:14px 18px;font-size:22px;color:#ccfbf1;">Step 2</div><div style="border-radius:999px;background:rgba(94,234,212,0.12);padding:14px 18px;font-size:22px;color:#ccfbf1;">Step 3</div></div><div class="image-slot" data-slot-id="playbook-cta-logo" data-slot-type="logo" data-slot-label="Logo" style="width:160px;height:84px;border-radius:24px;background:rgba(255,255,255,0.12);"></div></div></div>`,
      },
    ],
  },
];

export function getHtmlPresetById(presetId: string) {
  return SYSTEM_HTML_PRESETS.find((preset) => preset.id === String(presetId || "").trim()) || null;
}
