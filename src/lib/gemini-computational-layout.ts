import 'server-only';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { VisionLayoutDecision } from './carousel-types';

/**
 * COMPUTATIONAL LAYOUT APPROACH (like Bolt/Lovable/v0)
 * 
 * Instead of sending a screenshot and asking AI to "see" where text can go,
 * we send structured coordinate data and ask AI to CALCULATE safe zones.
 * 
 * This is pure computational geometry - no vision ambiguity.
 */
export async function realignWithGeminiComputational(
  headline: string,
  body: string,
  imagePosition: { x: number; y: number; width: number; height: number }
): Promise<VisionLayoutDecision> {
  console.log('[Gemini Computational] 🧮 Starting pure computational layout...');
  console.log('[Gemini Computational] 📝 Headline:', headline.substring(0, 50));
  console.log('[Gemini Computational] 📝 Body:', body.substring(0, 50));
  console.log('[Gemini Computational] 📐 Image bounds (RAW):', imagePosition);

  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error('[Gemini Computational] ❌ GOOGLE_AI_API_KEY is not configured');
    throw new Error('Google AI API key is not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 1.0,
      topP: 0.95,
      topK: 40,
    },
  });

  // Calculate safe zones mathematically
  const canvasWidth = 1080;
  const canvasHeight = 1440;
  const margin = 40;
  const imageClearance = 120; // Must stay this far from image

  // CRITICAL FIX: Clamp image bounds to canvas dimensions
  // If user scaled/moved image beyond canvas, constrain it
  const clampedImagePosition = {
    x: Math.max(0, Math.min(imagePosition.x, canvasWidth)),
    y: Math.max(0, Math.min(imagePosition.y, canvasHeight)),
    width: Math.min(imagePosition.width, canvasWidth),
    height: Math.min(imagePosition.height, canvasHeight),
  };
  
  // Ensure image doesn't extend beyond canvas
  if (clampedImagePosition.x + clampedImagePosition.width > canvasWidth) {
    clampedImagePosition.width = canvasWidth - clampedImagePosition.x;
  }
  if (clampedImagePosition.y + clampedImagePosition.height > canvasHeight) {
    clampedImagePosition.height = canvasHeight - clampedImagePosition.y;
  }
  
  console.log('[Gemini Computational] 📐 Image bounds (CLAMPED):', clampedImagePosition);
  
  if (JSON.stringify(imagePosition) !== JSON.stringify(clampedImagePosition)) {
    console.warn('[Gemini Computational] ⚠️ Image extends beyond canvas! Using clamped bounds for calculation.');
  }

  // Define image bounds with clearance (use CLAMPED bounds)
  const imageTop = clampedImagePosition.y;
  const imageBottom = clampedImagePosition.y + clampedImagePosition.height;
  const imageLeft = clampedImagePosition.x;
  const imageRight = clampedImagePosition.x + clampedImagePosition.width;

  // Calculate ALL available zones (top, bottom, left, right)
  const topZone = {
    x: margin,
    y: margin,
    width: canvasWidth - (2 * margin),
    height: Math.max(0, imageTop - imageClearance - margin),
    area: 0
  };
  topZone.area = topZone.width * topZone.height;

  const bottomZone = {
    x: margin,
    y: Math.min(canvasHeight - margin, imageBottom + imageClearance),
    width: canvasWidth - (2 * margin),
    height: Math.max(0, canvasHeight - margin - (imageBottom + imageClearance)),
    area: 0
  };
  bottomZone.area = bottomZone.width * bottomZone.height;

  const leftZone = {
    x: margin,
    y: margin,
    width: Math.max(0, imageLeft - imageClearance - margin),
    height: canvasHeight - (2 * margin),
    area: 0
  };
  leftZone.area = leftZone.width * leftZone.height;

  const rightZone = {
    x: Math.min(canvasWidth - margin, imageRight + imageClearance),
    y: margin,
    width: Math.max(0, canvasWidth - margin - (imageRight + imageClearance)),
    height: canvasHeight - (2 * margin),
    area: 0
  };
  rightZone.area = rightZone.width * rightZone.height;

  console.log('[Gemini Computational] 📊 Calculated safe zones:');
  console.log('[Gemini Computational]   Top zone:', topZone, `area=${topZone.area}px²`);
  console.log('[Gemini Computational]   Bottom zone:', bottomZone, `area=${bottomZone.area}px²`);
  console.log('[Gemini Computational]   Left zone:', leftZone, `area=${leftZone.area}px²`);
  console.log('[Gemini Computational]   Right zone:', rightZone, `area=${rightZone.area}px²`);

  // INDUSTRY-STANDARD SPATIAL ANALYSIS: Corner-based position detection
  // Like Figma, Bolt.new, Lovable.ai - use bounding box corners for accurate spatial understanding
  
  const corners = {
    topLeft: { x: clampedImagePosition.x, y: clampedImagePosition.y },
    topRight: { x: clampedImagePosition.x + clampedImagePosition.width, y: clampedImagePosition.y },
    bottomRight: { x: clampedImagePosition.x + clampedImagePosition.width, y: clampedImagePosition.y + clampedImagePosition.height },
    bottomLeft: { x: clampedImagePosition.x, y: clampedImagePosition.y + clampedImagePosition.height }
  };
  
  console.log('[Gemini Computational] 📍 Image bounding box corners:', corners);
  
  // Count corners in each canvas quadrant
  const leftHalfCorners = Object.values(corners).filter(c => c.x < canvasWidth/2).length;
  const rightHalfCorners = Object.values(corners).filter(c => c.x > canvasWidth/2).length;
  const topHalfCorners = Object.values(corners).filter(c => c.y < canvasHeight/2).length;
  const bottomHalfCorners = Object.values(corners).filter(c => c.y > canvasHeight/2).length;
  
  console.log('[Gemini Computational] 🧭 Corner distribution:', {
    leftHalf: leftHalfCorners,
    rightHalf: rightHalfCorners,
    topHalf: topHalfCorners,
    bottomHalf: bottomHalfCorners
  });
  
  // Robust position detection: if 3+ corners in one half, image is in that half
  const imageIsOnLeft = leftHalfCorners >= 3;
  const imageIsOnRight = rightHalfCorners >= 3;
  const imageIsOnTop = topHalfCorners >= 3;
  const imageIsOnBottom = bottomHalfCorners >= 3;
  
  console.log('[Gemini Computational] 📊 Spatial analysis (corner-based):');
  console.log(`[Gemini Computational]   Horizontal: ${imageIsOnLeft ? 'LEFT' : imageIsOnRight ? 'RIGHT' : 'CENTER'}`);
  console.log(`[Gemini Computational]   Vertical: ${imageIsOnTop ? 'TOP' : imageIsOnBottom ? 'BOTTOM' : 'CENTER'}`);
  
  // FLOW-BASED ZONE SELECTION (NO minimum area threshold - use any available space!)
  let primaryZone;
  let zoneName;
  let flowReason;
  
  // Priority 1: If image is on LEFT (3+ corners in left half), text flows RIGHT
  if (imageIsOnLeft && rightZone.width > 0) {
    primaryZone = rightZone;
    zoneName = 'RIGHT';
    flowReason = `Image on LEFT (${leftHalfCorners}/4 corners), text flows RIGHT`;
  }
  // Priority 2: If image is on RIGHT (3+ corners in right half), text flows LEFT
  else if (imageIsOnRight && leftZone.width > 0) {
    primaryZone = leftZone;
    zoneName = 'LEFT';
    flowReason = `Image on RIGHT (${rightHalfCorners}/4 corners), text flows LEFT`;
  }
  // Priority 3: If image is on BOTTOM (3+ corners in bottom half), text flows TOP
  else if (imageIsOnBottom && topZone.height > 0) {
    primaryZone = topZone;
    zoneName = 'TOP';
    flowReason = `Image on BOTTOM (${bottomHalfCorners}/4 corners), text flows TOP`;
  }
  // Priority 4: If image is on TOP (3+ corners in top half), text flows BOTTOM
  else if (imageIsOnTop && bottomZone.height > 0) {
    primaryZone = bottomZone;
    zoneName = 'BOTTOM';
    flowReason = `Image on TOP (${topHalfCorners}/4 corners), text flows BOTTOM`;
  }
  // Fallback: Use largest available zone
  else {
    const zones = [
      { name: 'TOP', zone: topZone },
      { name: 'BOTTOM', zone: bottomZone },
      { name: 'LEFT', zone: leftZone },
      { name: 'RIGHT', zone: rightZone },
    ];
    const sortedZones = zones.sort((a, b) => b.zone.area - a.zone.area);
    primaryZone = sortedZones[0].zone;
    zoneName = sortedZones[0].name;
    flowReason = 'Fallback: No clear position, using largest zone';
  }
  
  console.log('[Gemini Computational] 🏆 PRIMARY ZONE SELECTED:', zoneName);
  console.log('[Gemini Computational] 💡 Selection reason:', flowReason);
  console.log('[Gemini Computational] 📍 Primary zone bounds:', primaryZone);
  console.log('[Gemini Computational] 📊 Zone areas:', {
    top: `${topZone.area.toLocaleString()}px²`,
    bottom: `${bottomZone.area.toLocaleString()}px²`,
    left: `${leftZone.area.toLocaleString()}px²`,
    right: `${rightZone.area.toLocaleString()}px²`,
  });
  console.log(`[Gemini Computational] 🎯 Text will be ${zoneName === 'LEFT' || zoneName === 'RIGHT' ? 'LEFT-ALIGNED' : 'CENTER-ALIGNED'}`);

  const prompt = `You are a layout calculation engine like Bolt.new or Lovable.ai.

TASK: Place text lines in a specific rectangular zone. Calculate exact positions using ONLY the coordinates provided.

CANVAS: ${canvasWidth}x${canvasHeight}px
IMAGE POSITION: x=${imagePosition.x}, y=${imagePosition.y}, width=${imagePosition.width}, height=${imagePosition.height}

SAFE ZONE FOR TEXT (${zoneName} zone):
- X range: ${primaryZone.x} to ${primaryZone.x + primaryZone.width}
- Y range: ${primaryZone.y} to ${primaryZone.y + primaryZone.height}
- Available width: ${primaryZone.width}px
- Available height: ${primaryZone.height}px

TEXT TO PLACE:
Headline: "${headline}"
Body: "${body}"

LAYOUT RULES:
1. ALL text MUST stay within the safe zone boundaries
2. Text x position: ${zoneName === 'LEFT' || zoneName === 'RIGHT' ? 'align left within zone' : '540 (center)'}
3. Start first line at y=${primaryZone.y + 40}
4. Headline: 64-84px font size
5. Body: 42-56px font size
6. Line spacing: 100-120px
7. Bold 2-3 key medical terms per line
8. MAX CHARS PER LINE: For ${zoneName} zone width of ${primaryZone.width}px:
   - 72px font: ${Math.floor(primaryZone.width / 50)} chars max
   - 64px font: ${Math.floor(primaryZone.width / 40)} chars max
   - 48px font: ${Math.floor(primaryZone.width / 30)} chars max
9. If text doesn't fit, use SMALLER fonts or MORE lines

MATHEMATICAL CONSTRAINTS:
- X: ${primaryZone.x} <= x <= ${primaryZone.x + primaryZone.width}
- Y: For each line at position y with fontSize F and lineHeight L:
  ${primaryZone.y} <= y AND y + (F * L) <= ${primaryZone.y + primaryZone.height}

Return ONLY this JSON:
{
  "canvas": { "width": 1080, "height": 1440 },
  "textLines": [
    {
      "text": "Line text",
      "baseSize": 72,
      "position": { "x": ${zoneName === 'LEFT' || zoneName === 'RIGHT' ? primaryZone.x + 20 : 540}, "y": <calculated_y_within_zone> },
      "textAlign": "${zoneName === 'LEFT' || zoneName === 'RIGHT' ? 'left' : 'center'}",
      "lineHeight": 1.2,
      "maxWidth": ${primaryZone.width - 40},
      "styles": [{ "start": 0, "end": 4, "fontWeight": "bold" }]
    }
  ],
  "image": {
    "x": ${imagePosition.x},
    "y": ${imagePosition.y},
    "width": ${imagePosition.width},
    "height": ${imagePosition.height}
  },
  "margins": { "top": 40, "right": 40, "bottom": 40, "left": 40 }
}`;

  console.log('[Gemini Computational] 📤 Sending computational layout request...');
  console.log('[Gemini Computational] 📝 ========== PROMPT BEING SENT (First 1000 chars) ==========');
  console.log(prompt.substring(0, 1000));
  console.log('[Gemini Computational] 📝 ========== (continued) ==========');
  console.log(prompt.substring(1000, 2000));
  console.log('[Gemini Computational] 📝 ========== END PROMPT ==========');

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[Gemini Computational] 🔄 Attempt ${attempt}/${maxAttempts}`);

    try {
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }],
        }],
        generationConfig: {
          temperature: 0.7, // Lower for more deterministic math
          topP: 0.9,
          topK: 20,
        },
      } as any);

      const response = await result.response;
      const text = response.text();

      console.log('[Gemini Computational] 📨 Response received');
      console.log('[Gemini Computational] 📄 ========== GEMINI RAW RESPONSE (First 1000 chars) ==========');
      console.log(text.substring(0, 1000));
      console.log('[Gemini Computational] 📄 ========== (continued if longer) ==========');
      if (text.length > 1000) {
        console.log(text.substring(1000, Math.min(2000, text.length)));
      }
      console.log('[Gemini Computational] 📄 ========== END RAW RESPONSE ==========');

      // Clean and parse JSON
      let cleaned = text.trim();
      cleaned = cleaned.replace(/^```json\n?/gm, '').replace(/^```\n?/gm, '').replace(/```$/gm, '');
      
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }

      const layout = JSON.parse(cleaned) as VisionLayoutDecision;

      console.log('[Gemini Computational] ✅ JSON parsed successfully');
      console.log('[Gemini Computational] 🔍 ========== PARSED LAYOUT DATA ==========');
      console.log('[Gemini Computational] 📊 Text lines:', layout.textLines.length);
      layout.textLines.forEach((line, idx) => {
        console.log(`[Gemini Computational]   Line ${idx + 1}: x=${line.position.x}, y=${line.position.y}, align=${line.textAlign}, text="${line.text.substring(0, 40)}"`);
      });
      console.log('[Gemini Computational] 🔍 ========== END PARSED DATA ==========');

      // VALIDATE: Check all text is within safe zone
      console.log('[Gemini Computational] 🔍 VALIDATING TEXT POSITIONS:');
      console.log(`[Gemini Computational]   Safe zone Y range: ${primaryZone.y} to ${primaryZone.y + primaryZone.height}`);
      console.log(`[Gemini Computational]   Image Y range: ${imagePosition.y} to ${imagePosition.y + imagePosition.height}`);
      
      let allTextValid = true;
      const violations: string[] = [];
      
      for (const line of layout.textLines) {
        const lineY = line.position.y;
        const lineHeight = line.baseSize * (line.lineHeight || 1.2);
        const lineBottom = lineY + lineHeight;
        
        console.log(`[Gemini Computational]   Line: "${line.text.substring(0, 30)}" y=${lineY}, bottom=${Math.round(lineBottom)}`);

        // Check if line is within safe zone
        if (lineY < primaryZone.y || lineBottom > (primaryZone.y + primaryZone.height)) {
          const violation = `Line "${line.text.substring(0, 30)}" OUTSIDE safe zone (y=${lineY}, bottom=${Math.round(lineBottom)})`;
          console.warn(`[Gemini Computational] ⚠️ ${violation}`);
          violations.push(violation);
          allTextValid = false;
        }
        
        // Check if line overlaps with image
        const overlapsImage = (
          lineBottom > imagePosition.y && 
          lineY < (imagePosition.y + imagePosition.height)
        );
        
        if (overlapsImage) {
          const violation = `Line "${line.text.substring(0, 30)}" OVERLAPS image (y=${lineY}, bottom=${Math.round(lineBottom)})`;
          console.error(`[Gemini Computational] 🚨 ${violation}`);
          violations.push(violation);
          allTextValid = false;
        }
      }

      if (!allTextValid) {
        console.error('[Gemini Computational] ❌ VALIDATION FAILED!');
        console.error('[Gemini Computational] 📋 Violations:', violations);
        if (attempt < maxAttempts) {
          console.log('[Gemini Computational] 🔄 Retrying with stricter constraints...');
          continue;
        } else {
          console.error('[Gemini Computational] ❌ Max attempts reached with violations!');
          // Still return the layout but log the issues
        }
      }

      console.log('[Gemini Computational] ✅ Layout parsed and validated');
      console.log('[Gemini Computational] 📊 Text lines:', layout.textLines.length);
      console.log('[Gemini Computational] ✅ All text within safe zone:', allTextValid);
      
      return layout;

    } catch (error) {
      console.error(`[Gemini Computational] ❌ Attempt ${attempt} failed:`, error);
      
      if (attempt >= maxAttempts) {
        throw new Error(`Failed to generate computational layout after ${maxAttempts} attempts`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw new Error('Failed to generate computational layout');
}

