import 'server-only';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { VisionLayoutDecision } from './carousel-types';

/**
 * SIMPLE LAYOUT APPROACH
 * 
 * No zone calculations. No priorities. Just tell Gemini:
 * - Canvas size
 * - Where image is
 * - Place text where image ISN'T
 * - Make it aesthetically pleasing
 */
export async function realignWithGeminiSimple(
  headline: string,
  body: string,
  imagePosition: { x: number; y: number; width: number; height: number }
): Promise<VisionLayoutDecision> {
  console.log('[Gemini Simple] 🎨 Starting simple AI-driven layout...');
  console.log('[Gemini Simple] 📝 Headline:', headline.substring(0, 50));
  console.log('[Gemini Simple] 📝 Body:', body.substring(0, 50));
  console.log('[Gemini Simple] 📐 Image VISIBLE bounds (from client):', imagePosition);

  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error('[Gemini Simple] ❌ GOOGLE_AI_API_KEY is not configured');
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

  const canvasWidth = 1080;
  const canvasHeight = 1440;

  // Image might extend beyond canvas - calculate visible intersection
  const imageX = Math.round(imagePosition.x);
  const imageY = Math.round(imagePosition.y);
  const imageWidth = Math.round(imagePosition.width);
  const imageHeight = Math.round(imagePosition.height);
  const imageRight = imageX + imageWidth;
  const imageBottom = imageY + imageHeight;

  // Calculate VISIBLE portion of image on canvas
  const visibleImageX = Math.max(0, imageX);
  const visibleImageY = Math.max(0, imageY);
  const visibleImageRight = Math.min(canvasWidth, imageRight);
  const visibleImageBottom = Math.min(canvasHeight, imageBottom);

  // Calculate where the text COULD go (based on visible image bounds)
  const availableRight = canvasWidth - visibleImageRight - 40;
  const availableTop = visibleImageY - 40;
  const availableLeft = visibleImageX - 40;
  
  console.log('[Gemini Simple] 📐 Full image:', { x: imageX, y: imageY, width: imageWidth, height: imageHeight });
  console.log('[Gemini Simple] 📐 Visible on canvas:', { x: visibleImageX, y: visibleImageY, right: visibleImageRight, bottom: visibleImageBottom });
  console.log('[Gemini Simple] 📊 Available space: RIGHT=' + availableRight + 'px, TOP=' + availableTop + 'px, LEFT=' + availableLeft + 'px');
  
  const prompt = `You are a SPATIAL LAYOUT CALCULATOR. Calculate exact text positions to avoid image overlap.

CANVAS DIMENSIONS: ${canvasWidth} × ${canvasHeight}px

IMAGE VISIBLE AREA (NO TEXT ALLOWED HERE):
  x-range: ${visibleImageX} to ${visibleImageRight}
  y-range: ${visibleImageY} to ${visibleImageBottom}

TEXT TO FIT:
  Headline: "${headline}"
  Body: "${body}"

AVAILABLE ZONES (choose ONE and use its FULL space):

Zone A (TOP): 
  x: 80 to 1000 (920px wide)
  y: 40 to ${visibleImageY - 80} (${availableTop - 80}px tall)
  
Zone B (RIGHT):
  x: ${visibleImageRight + 80} to 1040 (${availableRight - 80}px wide)
  y: 40 to 1400 (1360px tall)
  
Zone C (LEFT):
  x: 40 to ${visibleImageX - 80} (${availableLeft - 80}px wide)
  y: 40 to 1400 (1360px tall)

POSITIONING ALGORITHM:
1. Select largest zone that fits all text
2. For WIDE zones (>500px): Use LEFT-ALIGN (x=80) or RIGHT-ALIGN (x=1000), NOT center
3. For NARROW zones (<500px): Stack vertically, left or right align within column
4. Spread text to use available space - don't cluster in center

CONCRETE EXAMPLE:
If image is at BOTTOM (like now), TOP zone is largest:
  ✓ GOOD: Lines at x=80, left-aligned → uses full width
  ✓ GOOD: Lines at x=100, left-aligned → dynamic placement
  ✗ BAD: Lines at x=540, center-aligned → wastes horizontal space

TEXT FORMATTING:
- Headline: 72-84px, bold key terms
- Body: 44-56px, bold 2-3 medical terms per line  
- Line spacing: 100-120px
- maxWidth: Zone width minus 100px padding

Return ONLY valid JSON (no markdown, no explanation):
{
  "canvas": { "width": 1080, "height": 1440 },
  "textLines": [
    {
      "text": "Line of text",
      "baseSize": 72,
      "position": { "x": <your_choice>, "y": <your_choice> },
      "textAlign": "left" | "center" | "right",
      "lineHeight": 1.2,
      "maxWidth": <appropriate_width>,
      "styles": [{ "start": 0, "end": 5, "fontWeight": "bold" }]
    }
  ],
  "image": {
    "x": ${imageX},
    "y": ${imageY},
    "width": ${imageWidth},
    "height": ${imageHeight}
  },
  "margins": { "top": 40, "right": 40, "bottom": 40, "left": 40 }
}`;

  console.log('[Gemini Simple] 📤 Sending simple prompt to Gemini...');
  console.log('[Gemini Simple] 📝 Prompt preview:', prompt.substring(0, 500) + '...');

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[Gemini Simple] 🔄 Attempt ${attempt}/${maxAttempts}`);

    try {
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }],
        }],
        generationConfig: {
          temperature: 1.0,
          topP: 0.95,
          topK: 40,
        },
      } as any);

      const response = await result.response;
      const text = response.text();

      console.log('[Gemini Simple] 📨 Response received');
      console.log('[Gemini Simple] 📄 Raw response (first 500 chars):', text.substring(0, 500));

      // Clean and parse JSON
      let cleaned = text.trim();
      cleaned = cleaned.replace(/^```json\n?/gm, '').replace(/^```\n?/gm, '').replace(/```$/gm, '');
      
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }

      const layout = JSON.parse(cleaned) as VisionLayoutDecision;

      // Basic validation
      if (!layout.textLines || layout.textLines.length === 0) {
        throw new Error('No text lines in response');
      }

      console.log('[Gemini Simple] ✅ Layout parsed successfully');
      console.log('[Gemini Simple] 📊 Text lines:', layout.textLines.length);
      
      // Log text positions for debugging
      layout.textLines.forEach((line, idx) => {
        console.log(`[Gemini Simple]   Line ${idx + 1}: "${line.text.substring(0, 40)}" at (${line.position.x}, ${line.position.y}), align=${line.textAlign}`);
      });

      return layout;

    } catch (error) {
      console.error(`[Gemini Simple] ❌ Attempt ${attempt} failed:`, error);
      
      if (attempt >= maxAttempts) {
        throw new Error(`Failed to generate layout after ${maxAttempts} attempts`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw new Error('Failed to generate layout');
}

