import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { TextLayoutDecision } from './carousel-types';

export async function decideTextLayout(
  headline: string,
  body: string,
  includeImage: boolean = false
): Promise<TextLayoutDecision> {
  console.log('[Claude] 🤖 Starting layout decision...');
  console.log('[Claude] 📝 Headline length:', headline.length, 'chars');
  console.log('[Claude] 📝 Body length:', body.length, 'chars');
  console.log('[Claude] 🖼️ Include image:', includeImage);

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  console.log('[Claude] 🔑 API key configured:', !!process.env.ANTHROPIC_API_KEY);

  const imageSection = includeImage ? `
INCLUDE IMAGE: Yes - A 1024x1024px medical illustration will be provided
- Image must be positioned within the content area
- Image should complement the text, not overlap
- Common layouts: image-left-text-right, image-top-text-bottom, or centered-image-with-text-above-below
- Image will be scaled to fit the layout
` : 'INCLUDE IMAGE: No - Text-only layout';

  const prompt = `You are a layout designer for Instagram carousel posts (1080x1440px portrait format).

Given this text:
HEADLINE: "${headline}" (${headline.length} characters)
BODY: "${body}" (${body.length} characters)
${imageSection}

CRITICAL RULES:
- Canvas: 1080x1440px with 60px margins on ALL sides
- Content area: 960x1320px (from x:60 to x:1020, y:60 to y:1380)
- Text MUST stay within content area considering line wrapping
- For textAlign "center": x should be 540 (center of canvas)
- For textAlign "left": x should be 60 (left margin)
- For textAlign "right": x should be 1020 minus maxWidth
- maxWidth determines where text wraps - text will wrap to fit within maxWidth
- Account for text height when positioning: longer text needs more vertical space
- No text overlap between headline and body
- Professional medical content aesthetic
- Readable font sizes (headline: 48-72px, body: 28-40px)
- Line spacing (1.2-1.5)

TEXT LENGTH ANALYSIS:
- Short text (<100 chars): Use larger fonts, centered, generous spacing
- Medium text (100-300 chars): Moderate fonts, ensure adequate wrapping space
- Long text (>300 chars): Smaller fonts, wider maxWidth, ensure full text fits

POSITIONING STRATEGY:
- Headline should be in upper portion (y: 60-400)
- Body should start below headline with spacing (y: headline.y + headline.fontSize*2 minimum)
- For centered text: x = 540, maxWidth should be symmetric (e.g., 800 leaves 100px margins each side)
- Ensure body doesn't extend beyond y: 1380 (bottom margin with more vertical space available)

Return ONLY valid JSON (no markdown, no explanation, no code blocks):
{
  "canvas": { "width": 1080, "height": 1440 },
  "headline": {
    "x": [exact x coordinate based on textAlign],
    "y": [between 60-300],
    "fontSize": [between 48-72],
    "maxWidth": [between 600-900, considers wrapping],
    "textAlign": "center|left|right",
    "fontWeight": "bold"
  },
  "body": {
    "x": [exact x coordinate based on textAlign, same as headline for consistency],
    "y": [headline.y + adequate spacing, ensure text fits within 1380 bottom limit],
    "fontSize": [between 28-40, smaller for longer text],
    "maxWidth": [same as headline for alignment],
    "lineHeight": [1.3-1.5],
    "textAlign": "center|left|right",
    "fontWeight": "normal"
  },
  ${includeImage ? `"image": {
    "x": [position within 60-1020],
    "y": [position within 60-1380, more vertical space available],
    "width": [200-600px, sized appropriately],
    "height": [200-600px, sized appropriately],
    "scale": [0.5-1.0, for fine-tuning size]
  },` : ''}
  "margins": { "top": 60, "right": 60, "bottom": 60, "left": 60 }
}`;

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`[Claude] 🔄 Attempt ${attempts}/${maxAttempts}`);
    
    try {
      console.log('[Claude] 📡 Sending request to Claude API...');
      const response = await client.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      console.log('[Claude] ✅ Response received from Claude');
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      console.log('[Claude] 📄 Raw response (first 100 chars):', content.text.substring(0, 100));

      // Clean up response - remove markdown code blocks if present
      const cleaned = content.text
        .trim()
        .replace(/^```json\n?/gm, '')
        .replace(/^```\n?/gm, '')
        .replace(/```$/gm, '');

      console.log('[Claude] 🧹 Cleaned response (first 100 chars):', cleaned.substring(0, 100));
      console.log('[Claude] 🔍 Parsing JSON...');
      const layout = JSON.parse(cleaned) as TextLayoutDecision;

      // Validate structure
      if (!layout.headline || !layout.body || !layout.canvas) {
        throw new Error('Invalid layout structure: missing required fields');
      }

      // Validate ranges
      if (layout.headline.fontSize < 40 || layout.headline.fontSize > 80) {
        throw new Error('Invalid headline fontSize');
      }
      if (layout.body.fontSize < 20 || layout.body.fontSize > 50) {
        throw new Error('Invalid body fontSize');
      }

      console.log('[Claude] ✅ Layout validated successfully');
      console.log('[Claude] 📐 Headline:', layout.headline);
      console.log('[Claude] 📐 Body:', layout.body);
      
      return layout;
    } catch (error) {
      console.error(`[Claude] ❌ Attempt ${attempts} failed:`, error);
      
      if (attempts === maxAttempts) {
        console.error('[Claude] 💥 All attempts exhausted');
        throw new Error(
          `Claude layout failed after ${maxAttempts} attempts: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
      
      // Wait a bit before retrying
      console.log('[Claude] ⏳ Waiting 1 second before retry...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error('Unreachable code');
}

