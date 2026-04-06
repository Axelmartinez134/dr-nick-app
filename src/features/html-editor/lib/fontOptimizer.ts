const SYSTEM_FONT_MAP: Record<string, { webFont: string; googleUrl: string }> = {
  arial: {
    webFont: "Noto Sans",
    googleUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800&display=swap",
  },
  helvetica: {
    webFont: "Noto Sans",
    googleUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800&display=swap",
  },
  inter: {
    webFont: "Inter",
    googleUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
  },
  "space grotesk": {
    webFont: "Space Grotesk",
    googleUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap",
  },
  "dm sans": {
    webFont: "DM Sans",
    googleUrl: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&display=swap",
  },
  manrope: {
    webFont: "Manrope",
    googleUrl: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
  },
  "ibm plex sans": {
    webFont: "IBM Plex Sans",
    googleUrl: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
  },
  georgia: {
    webFont: "Noto Serif",
    googleUrl: "https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;500;600;700&display=swap",
  },
  times: {
    webFont: "Noto Serif",
    googleUrl: "https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;500;600;700&display=swap",
  },
  "times new roman": {
    webFont: "Noto Serif",
    googleUrl: "https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;500;600;700&display=swap",
  },
};

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function optimizeHtmlFonts(html: string) {
  let nextHtml = String(html || "");
  const fontUrls: string[] = [];

  nextHtml = nextHtml.replace(/font-family\s*:\s*([^;"]+)/gi, (full, familyValue) => {
    const normalized = String(familyValue || "")
      .replace(/['"]/g, "")
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .find(Boolean);
    if (!normalized) return full;
    const mapped = SYSTEM_FONT_MAP[normalized];
    if (!mapped) return full;
    fontUrls.push(mapped.googleUrl);
    return full.replace(String(familyValue || ""), `'${mapped.webFont}', sans-serif`);
  });

  const importMatches = Array.from(nextHtml.matchAll(/@import\s+url\(([^)]+)\)\s*;?/gi));
  const importedUrls = importMatches.map((match) => String(match[1] || "").replace(/['"]/g, "").trim()).filter(Boolean);
  if (importedUrls.length) {
    nextHtml = nextHtml.replace(/@import\s+url\(([^)]+)\)\s*;?/gi, "");
    fontUrls.push(...importedUrls);
  }

  const existingLinkMatches = Array.from(nextHtml.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi));
  fontUrls.push(
    ...existingLinkMatches
      .map((match) => String(match[1] || "").trim())
      .filter((url) => url.includes("fonts.googleapis.com"))
  );

  return {
    html: nextHtml,
    fontUrls: unique(fontUrls),
  };
}
