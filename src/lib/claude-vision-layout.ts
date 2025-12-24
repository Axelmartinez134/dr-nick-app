import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { VisionLayoutDecision } from './carousel-types';

export async function decideVisionBasedLayout(
  headline: string,
  body: string,
  imageBase64: string,
  imagePosition: { x: number; y: number; width: number; height: number }
): Promise<VisionLayoutDecision> {
  console.log('[Claude Vision] 🤖 Starting vision-based layout decision...');
  console.log('[Claude Vision] 📝 Headline length:', headline.length, 'chars');
  console.log('[Claude Vision] 📝 Body length:', body.length, 'chars');
  console.log('[Claude Vision] 🖼️ Image position:', imagePosition);
  console.log('[Claude Vision] 📏 Image base64 length:', imageBase64.length, 'chars');

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  console.log('[Claude Vision] 🔑 API key configured:', !!process.env.ANTHROPIC_API_KEY);

  const prompt = `CRITICAL: You MUST respond with ONLY valid JSON. No explanation, no description, no markdown. Just pure JSON.

You are designing a SOCIAL MEDIA CAROUSEL POST for Instagram/LinkedIn (1080x1440px).
This must be AESTHETIC, SCANNABLE, and ENGAGING for social feeds.

CANVAS: 1080x1440px, margins: 60px all sides
IMAGE: Already positioned at x=${imagePosition.x}, y=${imagePosition.y}, size: ${imagePosition.width}x${imagePosition.height}

CONTENT:
Headline: "${headline}"
Body: "${body}"

SOCIAL MEDIA DESIGN PRINCIPLES:
1. **Visual Hierarchy**: Largest text at top, decrease size as you go down
2. **Breathing Room**: Generous spacing between text blocks (80-120px gaps)
3. **Scannable**: Bold 2-3 KEY WORDS per line that jump out (medical terms, numbers, outcomes)
4. **Balance**: Text and image should feel harmonious, not cramped
5. **Professional Medical Aesthetic**: Clean, modern, trustworthy

CRITICAL SPATIAL ANALYSIS (MOST IMPORTANT):
1. **VISUALLY examine the image** - Where is the actual medical illustration content?
2. **Estimated image area** (may not be exact): 
   - X: ${imagePosition.x}px to ${imagePosition.x + imagePosition.width}px
   - Y: ${imagePosition.y}px to ${imagePosition.y + imagePosition.height}px
3. **OVERRIDE if visual differs**: If you see the image extends beyond these bounds, use what you SEE
4. **Add safety buffer**: Add 50-80px clearance around the VISUAL image boundaries
5. **Calculate safe text zones**:
   - If image is in BOTTOM half (y > 720): Place ALL text ABOVE at y: 60-700
   - If image is in TOP half (y < 720): Place ALL text BELOW at y: 800-1380
   - If image is LEFT side: Place text RIGHT side with x > (image_right + 80)
   - If image is RIGHT side: Place text LEFT side with x < (image_left - 80)
   - If image is CENTER: Place text ABOVE or BELOW only

TEXT PLACEMENT RULES (FOLLOW STRICTLY):
- **SAFEST APPROACH**: Place ALL text either ABOVE or BELOW the image (never beside)
- **Text above**: Use y range [60, 700] if image is in bottom half
- **Text below**: Use y range [800, 1380] if image is in top half
- **NEVER EVER place text** in the same y-range as the image
- **Always use CENTER alignment** (x=540) for social media aesthetics
- **Minimum clearance**: 80px between text and image boundaries
- **Line spacing**: 80-120px between text lines for readability
- **Break content**: 3-4 separate lines, ~40-60 characters per line

EMPHASIS RULES (CRITICAL):
- Bold 2-3 attention-grabbing words PER LINE
- Target: Medical terms ("visceral fat", "endocrine"), outcomes ("preventable", "inflammation"), numbers ("30", "40")
- Make text scannable - readers should grasp key points in 3 seconds
- Use italic SPARINGLY (only 1-2 words total if needed for subtle emphasis)

FONT SIZING FOR SOCIAL:
- Main headline: 64-84px (big impact!)
- Subheadline/emphasis: 48-64px
- Body text: 36-48px (readable on mobile)
- Line height: 1.3-1.4 for readability

ALIGNMENT:
- Headlines: CENTER (looks best on social)
- Body: CENTER or LEFT (center for short text, left for longer)
- Keep consistent within each section

EXAMPLE - If image is at y=800-1400 (bottom area):
{
  "canvas": { "width": 1080, "height": 1440 },
  "textLines": [
    {
      "text": "Visceral Fat: The Invisible Driver",
      "baseSize": 72,
      "position": { "x": 540, "y": 100 },
      "textAlign": "center",
      "lineHeight": 1.3,
      "maxWidth": 960,
      "styles": [{ "start": 0, "end": 12, "fontWeight": "bold" }]
    },
    {
      "text": "of Inflammation and Early Ageing",
      "baseSize": 64,
      "position": { "x": 540, "y": 210 },
      "textAlign": "center",
      "lineHeight": 1.3,
      "maxWidth": 900,
      "styles": [
        { "start": 3, "end": 16, "fontWeight": "bold" },
        { "start": 27, "end": 33, "fontWeight": "bold" }
      ]
    },
    {
      "text": "Visceral fat is an endocrine organ",
      "baseSize": 44,
      "position": { "x": 540, "y": 340 },
      "textAlign": "center",
      "lineHeight": 1.4,
      "maxWidth": 900,
      "styles": [
        { "start": 0, "end": 12, "fontWeight": "bold" },
        { "start": 19, "end": 34, "fontWeight": "bold" }
      ]
    },
    {
      "text": "releasing cytokines that accelerate ageing.",
      "baseSize": 44,
      "position": { "x": 540, "y": 410 },
      "textAlign": "center",
      "lineHeight": 1.4,
      "maxWidth": 900,
      "styles": [
        { "start": 10, "end": 19, "fontWeight": "bold" },
        { "start": 25, "end": 35, "fontWeight": "bold" }
      ]
    }
  ],
  "image": {
    "x": ${imagePosition.x},
    "y": ${imagePosition.y},
    "width": ${imagePosition.width},
    "height": ${imagePosition.height},
    "url": "[will be filled by system]"
  },
  "margins": { "top": 60, "right": 60, "bottom": 60, "left": 60 }
}

CRITICAL RULES TO FOLLOW:
1. **VERTICAL SEPARATION**: ALL text must be completely ABOVE (y: 60-700) OR completely BELOW (y: 850-1380) the image
2. **NO HORIZONTAL PLACEMENT**: Never place text beside the image, only above or below
3. **Character indices**: 0-based, "start" inclusive, "end" exclusive  
   Example: To bold "Visceral" (chars 0-8) in "Visceral Fat", use { "start": 0, "end": 8 }
4. **Line breaks**: Split into 3-4 lines, ~40-60 characters per line
5. **Spacing**: 90-110px between lines, 80px minimum from image

VISUAL CHECK: Look at the image and confirm your text positions won't overlap!

RESPOND WITH ONLY THE JSON (no other text):

`;

  let attempts = 0;
  const maxAttempts = 3;

  let lastResponseText = '';
  
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`[Claude Vision] 🔄 Attempt ${attempts}/${maxAttempts}`);
    
    try {
      console.log('[Claude Vision] 📡 Sending request to Claude Vision API...');
      const response = await client.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 2048,
        system: 'You are a JSON-only API for social media carousel design. CRITICAL RULES: 1) Respond with ONLY valid JSON, no other text. 2) NEVER place text where it overlaps the image. 3) Calculate safe zones carefully by analyzing the image position. 4) All text must be in clear white space only.',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: imageBase64.replace(/^data:image\/png;base64,/, ''),
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      console.log('[Claude Vision] ✅ Response received from Claude');
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      lastResponseText = content.text;
      console.log('[Claude Vision] 📄 Raw response (first 200 chars):', content.text.substring(0, 200));

      // Clean up response - remove markdown code blocks if present
      let cleaned = content.text.trim();
      
      // Remove markdown code blocks
      cleaned = cleaned.replace(/^```json\n?/gm, '').replace(/^```\n?/gm, '').replace(/```$/gm, '');
      
      // Try to extract JSON if Claude added explanatory text
      // Look for content between { and } (greedy match for the full object)
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
        console.log('[Claude Vision] 🔍 Extracted JSON from response');
      }

      console.log('[Claude Vision] 🧹 Cleaned response (first 200 chars):', cleaned.substring(0, 200));

      // Parse JSON
      const layout = JSON.parse(cleaned) as VisionLayoutDecision;
      
      // Validate structure
      if (!layout.textLines || !Array.isArray(layout.textLines)) {
        throw new Error('Invalid layout: missing textLines array');
      }

      if (layout.textLines.length === 0) {
        throw new Error('Invalid layout: no text lines provided');
      }

      console.log('[Claude Vision] ✅ Layout parsed successfully');
      console.log('[Claude Vision] 📊 Text lines:', layout.textLines.length);
      console.log('[Claude Vision] 📐 First line:', {
        text: layout.textLines[0].text.substring(0, 50),
        size: layout.textLines[0].baseSize,
        position: layout.textLines[0].position,
        stylesCount: layout.textLines[0].styles.length,
      });

      // Add the image URL to the layout
      if (layout.image) {
        layout.image.url = imageBase64;
      }

      return layout;
    } catch (error) {
      console.error(`[Claude Vision] ❌ Attempt ${attempts} failed:`, error);
      
      if (attempts >= maxAttempts) {
        console.error('[Claude Vision] ❌ All attempts exhausted');
        console.error('[Claude Vision] 📄 Last response received (first 500 chars):', lastResponseText.substring(0, 500));
        throw new Error(`Failed to parse layout JSON from Claude after ${maxAttempts} attempts. Claude may be returning descriptive text instead of JSON. Check server logs for full response.`);
      }
      
      console.log('[Claude Vision] 🔄 Retrying...');
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }

  throw new Error('Failed to generate layout');
}

/**
 * Realign text layout based on user-repositioned image.
 * This function is called after the user manually moves the image on the canvas.
 * It regenerates the text layout from scratch with EXTREME focus on spatial constraints.
 */
export async function realignTextLayout(
  headline: string,
  body: string,
  canvasScreenshot: string, // base64 PNG of current canvas state
  imagePosition: { x: number; y: number; width: number; height: number }
): Promise<VisionLayoutDecision> {
  console.log('[Claude Realign] 🔄 Starting text realignment...');
  console.log('[Claude Realign] 📝 Headline length:', headline.length, 'chars');
  console.log('[Claude Realign] 📝 Body length:', body.length, 'chars');
  console.log('[Claude Realign] 🖼️ Image position:', imagePosition);
  console.log('[Claude Realign] 📸 Screenshot length:', canvasScreenshot.length, 'chars');

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  console.log('[Claude Realign] 🔑 API key configured:', !!process.env.ANTHROPIC_API_KEY);

  // Extract base64 from data URL
  const base64Data = canvasScreenshot.replace(/^data:image\/png;base64,/, '');

  const prompt = `CRITICAL: You MUST respond with ONLY valid JSON. No explanation, no description, no markdown. Just pure JSON.

🔴 CRITICAL INSTRUCTION: The screenshot shows ONLY the image and background - NO TEXT.
The image you see is where the user positioned it. Your job is to place text in the WHITE/EMPTY areas.

You are creating a NEW text layout for a SOCIAL MEDIA CAROUSEL POST (1080x1440px portrait).
The user has manually positioned the image. Use VISUAL ANALYSIS to find empty space.

📸 WHAT YOU'RE SEEING IN THE SCREENSHOT:
- ✅ White/light gray background
- ✅ A medical illustration image (user-positioned)
- ❌ NO TEXT (we removed it so you see clearly where to place new text)

📐 YOUR VISUAL ANALYSIS STEPS:
1. **LOOK at the screenshot** - See exactly where the image boundaries are
2. **Identify EMPTY WHITE SPACE** - This is where text MUST go
3. **Measure the empty space visually** - How much room do you have?
4. **Determine text placement strategy**:
   - If image is in LOWER 60% (y > 600): Stack ALL text at TOP (y: 40-550)
   - If image is in LEFT/RIGHT side: You can use the opposite side
   - If image is in MIDDLE: Use space above OR below (not both)
5. **NEVER place text where you see the image** - Leave 120px buffer minimum

🚨 ABSOLUTE RULES (BREAK THESE = FAILURE):

1. **VISUAL-FIRST APPROACH**:
   - PRIMARY: Look at the screenshot and identify where the image IS
   - SECONDARY: Use the coordinates as a backup reference
   - If the visual and coordinates conflict, TRUST THE VISUAL

2. **40px SAFE MARGIN** - NO TEXT within 40px of canvas edges:
   - Left: x >= 40
   - Right: x + maxWidth <= 1040
   - Top: y >= 40  
   - Bottom: y + text height <= 1400

3. **120px MINIMUM CLEARANCE from the image you see in the screenshot**:
   - Look at the screenshot
   - See where the image boundaries are
   - Add 120px buffer zone around those boundaries
   - NO TEXT in that buffer zone

4. **SAFEST APPROACH FOR BOTTOM-HEAVY IMAGES**:
   - If image occupies y > 600 (lower half), place ALL text at y: 40-550
   - If image occupies y < 700 (upper half), place ALL text at y: 850-1380
   - NEVER stack text beside a large image - always above OR below

5. **CHARACTER/WIDTH CALCULATION**:
   - 72px font: ~12-15 chars per line (maxWidth ~900px)
   - 64px font: ~14-17 chars per line
   - 48px font: ~18-22 chars per line
   - If text is longer, use MORE LINES or SMALLER FONT

REFERENCE COORDINATES (but trust screenshot more):
- Image reported at: x=${imagePosition.x}, y=${imagePosition.y}
- Image size: ${imagePosition.width}x${imagePosition.height}
- (These may not be perfectly accurate - use your visual analysis)

CONTENT TO LAYOUT:
Headline: "${headline}"
Body: "${body}"

LAYOUT STRATEGY:
1. **VISUALLY analyze the screenshot** - Where is the image actually positioned?
2. **Calculate safe text zone**: Find the largest continuous WHITE space
3. **If image is in bottom 60%**: Stack ALL text lines at top (y: 40-550)
4. **If image is in top 40%**: Stack ALL text lines at bottom (y: 850-1380)
5. **Use large fonts** for headlines (64-84px), smaller for body (42-56px)
6. **Center-align** all text (x=540 with textAlign "center")
7. **Generous spacing** between lines (100-130px gaps)
8. **Bold 2-3 key words** per line for emphasis

TEXT STYLING:
- Bold: medical terms, numbers, key outcomes (fontWeight: "bold")
- Keep it scannable and professional

⚠️ FINAL CHECK BEFORE RESPONDING:
1. Look at the screenshot one more time
2. Verify EVERY text line y-position does not overlap with where you SEE the image
3. If in doubt, move text FURTHER AWAY from the image
4. Better to have text too far from image than overlapping

RESPOND WITH ONLY THIS JSON (no markdown, no explanation):
{
  "canvas": { "width": 1080, "height": 1440 },
  "textLines": [
    {
      "text": "Your text here",
      "baseSize": 72,
      "position": { "x": 540, "y": 120 },
      "textAlign": "center",
      "lineHeight": 1.25,
      "maxWidth": 900,
      "styles": [
        { "start": 0, "end": 4, "fontWeight": "bold" }
      ]
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

  const maxAttempts = 3;
  let lastResponseText = '';

  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    console.log(`[Claude Realign] 🔄 Attempt ${attempts}/${maxAttempts}`);

    try {
      const response = await client.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4096,
        system: [
          {
            type: 'text',
            text: 'You are a JSON-only API. You MUST respond with valid JSON only. Never include explanations, markdown, or any text outside the JSON structure. Your entire response must be parseable as JSON.',
          },
        ],
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      console.log('[Claude Realign] 📨 Response received');
      console.log('[Claude Realign] 📊 Response type:', response.content[0].type);

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Expected text response from Claude');
      }

      lastResponseText = content.text;
      console.log('[Claude Realign] 📄 Raw response (first 200 chars):', content.text.substring(0, 200));

      // Clean up response - remove markdown code blocks if present
      let cleaned = content.text.trim();
      
      // Remove markdown code blocks
      cleaned = cleaned.replace(/^```json\n?/gm, '').replace(/^```\n?/gm, '').replace(/```$/gm, '');
      
      // Try to extract JSON if Claude added explanatory text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
        console.log('[Claude Realign] 🔍 Extracted JSON from response');
      }

      console.log('[Claude Realign] 🧹 Cleaned response (first 200 chars):', cleaned.substring(0, 200));

      // Parse JSON
      const layout = JSON.parse(cleaned) as VisionLayoutDecision;
      
      // Validate structure
      if (!layout.textLines || !Array.isArray(layout.textLines)) {
        throw new Error('Invalid layout: missing textLines array');
      }

      if (layout.textLines.length === 0) {
        throw new Error('Invalid layout: no text lines provided');
      }

      console.log('[Claude Realign] ✅ Layout parsed successfully');
      console.log('[Claude Realign] 📊 Text lines:', layout.textLines.length);
      console.log('[Claude Realign] 📐 First line:', {
        text: layout.textLines[0].text.substring(0, 50),
        size: layout.textLines[0].baseSize,
        position: layout.textLines[0].position,
        stylesCount: layout.textLines[0].styles.length,
      });

      return layout;
    } catch (error) {
      console.error(`[Claude Realign] ❌ Attempt ${attempts} failed:`, error);
      
      if (attempts >= maxAttempts) {
        console.error('[Claude Realign] ❌ All attempts exhausted');
        console.error('[Claude Realign] 📄 Last response received (first 500 chars):', lastResponseText.substring(0, 500));
        throw new Error(`Failed to realign layout after ${maxAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      console.log('[Claude Realign] 🔄 Retrying...');
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }

  throw new Error('Failed to realign text layout');
}

