import 'server-only';

/**
 * LAYOUT ENGINE - Deterministic Safe Zone Calculator
 * 
 * This module handles ALL spatial math. The AI never sees raw coordinates.
 * Instead, the AI picks "intent" (flexbox-style), and we translate to pixels.
 */

export interface SafeZone {
  id: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
}

export interface ImageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutIntent {
  selectedZone: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
  alignItems: 'flex-start' | 'center' | 'flex-end';
  textLines: Array<{
    text: string;
    fontSize: number;
    fontWeight?: string;
    styles?: Array<{ start: number; end: number; fontWeight?: string; fontStyle?: string }>;
  }>;
}

export interface PixelLayout {
  textLines: Array<{
    text: string;
    baseSize: number;
    position: { x: number; y: number };
    textAlign: 'left' | 'center' | 'right';
    lineHeight: number;
    maxWidth: number;
    styles?: Array<{ start: number; end: number; fontWeight?: string; fontStyle?: string }>;
  }>;
  image: ImageBounds;
  margins: { top: number; right: number; bottom: number; left: number };
}

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1440;
const CANVAS_MARGIN = 40;
const IMAGE_CLEARANCE = 80;
const DEFAULT_LINE_HEIGHT = 1.2;
const AVG_CHAR_WIDTH_EM = 0.56; // conservative-ish for Arial; used to avoid Fabric Textbox wrapping

function getZoneInnerPadding(zone: SafeZone): number {
  // Narrow columns need less padding or they become unusable.
  // Keep it deterministic and shared between validation + translation.
  return zone.width < 300 ? 20 : 40;
}

export interface IntentFitValidation {
  ok: boolean;
  reasons: string[];
  computed: {
    maxWidth: number;
    availableHeight: number;
    totalLineHeights: number;
    dynamicGap: number;
    totalLines: number;
    innerPadding: number;
  };
}

/**
 * Validate that an intent can fit inside a zone WITHOUT relying on negative gaps
 * and WITHOUT Fabric.js Textbox wrapping inside a "single line object".
 */
export function validateIntentFitsZone(intent: LayoutIntent, zone: SafeZone): IntentFitValidation {
  const reasons: string[] = [];
  const totalLines = intent.textLines.length;

  const innerPadding = getZoneInnerPadding(zone);
  const maxWidth = Math.round(zone.width - (2 * innerPadding));
  if (maxWidth <= 0) {
    reasons.push(`Zone too narrow after padding: maxWidth=${maxWidth}`);
  }

  const availableHeight = Math.round(zone.height - (2 * innerPadding));
  if (availableHeight <= 0) {
    reasons.push(`Zone too short after padding: availableHeight=${availableHeight}`);
  }

  // Validate each "line object" won't wrap inside Fabric.Textbox
  for (let i = 0; i < totalLines; i++) {
    const line = intent.textLines[i];
    const text = (line.text ?? '').trim();
    if (!text) {
      reasons.push(`Line ${i + 1} is empty`);
      continue;
    }
    if (line.fontSize <= 0 || !Number.isFinite(line.fontSize)) {
      reasons.push(`Line ${i + 1} has invalid fontSize=${line.fontSize}`);
      continue;
    }

    // Very rough but practical: enforce "no internal wrapping" by limiting chars.
    // If this fails, Fabric.Textbox will likely wrap and height will be larger than we model.
    const estimatedCharPx = line.fontSize * AVG_CHAR_WIDTH_EM;
    const maxChars = Math.max(1, Math.floor(maxWidth / estimatedCharPx));
    if (text.length > maxChars) {
      reasons.push(`Line ${i + 1} too long for maxWidth: len=${text.length} > maxChars≈${maxChars} (font=${line.fontSize}, maxWidth=${maxWidth})`);
    }
  }

  const totalLineHeights = intent.textLines.reduce((sum, line) => sum + (line.fontSize * DEFAULT_LINE_HEIGHT), 0);
  const dynamicGap = totalLines > 1
    ? (availableHeight - totalLineHeights) / (totalLines - 1)
    : 0;

  if (!Number.isFinite(dynamicGap)) {
    reasons.push(`Invalid gap computed: gap=${dynamicGap}`);
  } else if (dynamicGap < 0) {
    reasons.push(`Does not fit vertically (negative gap): gap=${Math.round(dynamicGap * 10) / 10}px`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
    computed: {
      maxWidth,
      availableHeight,
      totalLineHeights: Math.round(totalLineHeights),
      dynamicGap: Math.round(dynamicGap * 10) / 10,
      totalLines,
      innerPadding
    }
  };
}

/**
 * Calculate all available safe zones around an image
 */
export function calculateSafeZones(imageBounds: ImageBounds): SafeZone[] {
  console.log('[Layout Engine] 📐 Calculating safe zones for image:', imageBounds);

  // Clamp image to canvas bounds to get visible portion
  const visibleImageX = Math.max(0, imageBounds.x);
  const visibleImageY = Math.max(0, imageBounds.y);
  const visibleImageRight = Math.min(CANVAS_WIDTH, imageBounds.x + imageBounds.width);
  const visibleImageBottom = Math.min(CANVAS_HEIGHT, imageBounds.y + imageBounds.height);

  const zones: SafeZone[] = [];

  // TOP ZONE: From canvas top to image top
  const topZoneHeight = visibleImageY - CANVAS_MARGIN - IMAGE_CLEARANCE;
  if (topZoneHeight > 100) {
    const topZone: SafeZone = {
      id: 'TOP',
      x: CANVAS_MARGIN,
      y: CANVAS_MARGIN,
      width: CANVAS_WIDTH - (2 * CANVAS_MARGIN),
      height: topZoneHeight,
      area: (CANVAS_WIDTH - (2 * CANVAS_MARGIN)) * topZoneHeight
    };
    zones.push(topZone);
    console.log('[Layout Engine] ✅ TOP zone:', topZone);
  }

  // BOTTOM ZONE: From image bottom to canvas bottom
  const bottomZoneHeight = CANVAS_HEIGHT - visibleImageBottom - CANVAS_MARGIN - IMAGE_CLEARANCE;
  if (bottomZoneHeight > 100) {
    const bottomZone: SafeZone = {
      id: 'BOTTOM',
      x: CANVAS_MARGIN,
      y: visibleImageBottom + IMAGE_CLEARANCE,
      width: CANVAS_WIDTH - (2 * CANVAS_MARGIN),
      height: bottomZoneHeight,
      area: (CANVAS_WIDTH - (2 * CANVAS_MARGIN)) * bottomZoneHeight
    };
    zones.push(bottomZone);
    console.log('[Layout Engine] ✅ BOTTOM zone:', bottomZone);
  }

  // LEFT ZONE: From canvas left to image left
  const leftZoneWidth = visibleImageX - CANVAS_MARGIN - IMAGE_CLEARANCE;
  if (leftZoneWidth > 100) {
    const leftZone: SafeZone = {
      id: 'LEFT',
      x: CANVAS_MARGIN,
      y: CANVAS_MARGIN,
      width: leftZoneWidth,
      height: CANVAS_HEIGHT - (2 * CANVAS_MARGIN),
      area: leftZoneWidth * (CANVAS_HEIGHT - (2 * CANVAS_MARGIN))
    };
    zones.push(leftZone);
    console.log('[Layout Engine] ✅ LEFT zone:', leftZone);
  }

  // RIGHT ZONE: From image right to canvas right
  const rightZoneWidth = CANVAS_WIDTH - visibleImageRight - CANVAS_MARGIN - IMAGE_CLEARANCE;
  if (rightZoneWidth > 100) {
    const rightZone: SafeZone = {
      id: 'RIGHT',
      x: visibleImageRight + IMAGE_CLEARANCE,
      y: CANVAS_MARGIN,
      width: rightZoneWidth,
      height: CANVAS_HEIGHT - (2 * CANVAS_MARGIN),
      area: rightZoneWidth * (CANVAS_HEIGHT - (2 * CANVAS_MARGIN))
    };
    zones.push(rightZone);
    console.log('[Layout Engine] ✅ RIGHT zone:', rightZone);
  }

  console.log('[Layout Engine] 📊 Total safe zones found:', zones.length);
  return zones;
}

/**
 * Select the best zone based on spatial awareness of image position
 */
export function selectBestZone(zones: SafeZone[]): SafeZone | null {
  if (zones.length === 0) {
    console.error('[Layout Engine] ❌ No safe zones available!');
    return null;
  }

  console.log('[Layout Engine] 🎯 Analyzing zones for best placement...');
  
  // Filter out zones that are too narrow for text (< 400px width)
  const usableZones = zones.filter(zone => {
    const isUsable = zone.width >= 400;
    console.log(`[Layout Engine]   ${zone.id}: ${zone.width}x${zone.height}px (area=${Math.round(zone.area)}) ${isUsable ? '✅' : '❌ too narrow'}`);
    return isUsable;
  });

  // If we have usable zones, pick the largest one
  if (usableZones.length > 0) {
    const best = usableZones.reduce((max, zone) => zone.area > max.area ? zone : max, usableZones[0]);
    console.log('[Layout Engine] 🎯 Selected zone:', best.id, `(${best.width}x${best.height}px, area=${Math.round(best.area)})`);
    return best;
  }

  // Fallback: If all zones are narrow, pick the largest anyway
  const best = zones.reduce((max, zone) => zone.area > max.area ? zone : max, zones[0]);
  console.log('[Layout Engine] ⚠️ All zones narrow, using largest:', best.id, `(${best.width}x${best.height}px)`);
  return best;
}

/**
 * Translate Flexbox intent to pixel coordinates with DYNAMIC gap calculation
 */
export function translateIntentToPixels(
  intent: LayoutIntent,
  zone: SafeZone,
  imageBounds: ImageBounds
): PixelLayout {
  console.log('[Layout Engine] 🔄 Translating intent to pixels...');
  console.log('[Layout Engine] 📍 Zone:', zone.id, `${zone.width}x${zone.height}px at (${zone.x}, ${zone.y})`);
  console.log('[Layout Engine] 🎨 Intent:', {
    alignItems: intent.alignItems,
    lines: intent.textLines.length
  });

  const textLines = [];
  const totalLines = intent.textLines.length;
  const validation = validateIntentFitsZone(intent, zone);
  if (!validation.ok) {
    console.warn('[Layout Engine] ❌ Intent failed fit validation:', {
      zone: zone.id,
      reasons: validation.reasons,
      computed: validation.computed
    });
    throw new Error(`Intent does not fit in zone ${zone.id}: ${validation.reasons.join(' | ')}`);
  }
  
  // Calculate X position based on alignItems
  let baseX: number;
  let textAlign: 'left' | 'center' | 'right';
  const innerPadding = validation.computed.innerPadding;
  
  if (intent.alignItems === 'flex-start') {
    baseX = zone.x + innerPadding; // Left padding within zone
    textAlign = 'left';
  } else if (intent.alignItems === 'flex-end') {
    baseX = zone.x + zone.width - innerPadding; // Right padding within zone
    textAlign = 'right';
  } else {
    baseX = zone.x + zone.width / 2; // Center of zone
    textAlign = 'center';
  }

  // DYNAMIC GAP CALCULATION
  // IMPORTANT: Use lineHeight in the math, because each Fabric object has height ~= fontSize * lineHeight.
  const totalLineHeights = intent.textLines.reduce((sum, line) => sum + (line.fontSize * DEFAULT_LINE_HEIGHT), 0);
  const availableHeight = zone.height - (2 * innerPadding);
  const dynamicGap = totalLines > 1
    ? (availableHeight - totalLineHeights) / (totalLines - 1)
    : 0;

  console.log('[Layout Engine] 📏 Dynamic gap calculation:');
  console.log('[Layout Engine]   Zone height:', zone.height);
  console.log('[Layout Engine]   Total line heights:', Math.round(totalLineHeights));
  console.log('[Layout Engine]   Available height:', availableHeight);
  console.log('[Layout Engine]   Calculated gap:', Math.round(dynamicGap * 10) / 10, 'px');

  // At this point validation already ensured gap >= 0.
  const finalGap = dynamicGap;

  // Calculate Y positions with dynamic gap
  let currentY = zone.y + innerPadding; // Start at top padding

  // Build final text lines with pixel positions
  for (let i = 0; i < totalLines; i++) {
    const line = intent.textLines[i];
    const lineHeightPx = line.fontSize * DEFAULT_LINE_HEIGHT;
    
    textLines.push({
      text: line.text,
      baseSize: line.fontSize,
      position: {
        x: Math.round(baseX),
        y: Math.round(currentY)
      },
      textAlign,
      lineHeight: DEFAULT_LINE_HEIGHT,
      maxWidth: Math.round(zone.width - (2 * innerPadding)), // Zone width minus padding
      styles: line.styles || []
    });

    // Move to next line position
    currentY += lineHeightPx + finalGap;
  }

  console.log('[Layout Engine] ✅ Translation complete:');
  textLines.forEach((line, i) => {
    const lineBottom = line.position.y + (line.baseSize * line.lineHeight);
    const withinZone = lineBottom <= (zone.y + zone.height);
    console.log(`[Layout Engine]   Line ${i + 1}: "${line.text.substring(0, 30)}..." at (${line.position.x}, ${line.position.y}), bottom=${Math.round(lineBottom)} ${withinZone ? '✅' : '❌ OVERFLOW'}`);
  });

  return {
    textLines,
    image: imageBounds,
    margins: { top: CANVAS_MARGIN, right: CANVAS_MARGIN, bottom: CANVAS_MARGIN, left: CANVAS_MARGIN }
  };
}

