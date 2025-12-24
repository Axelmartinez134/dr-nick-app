import 'server-only';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { VisionLayoutDecision } from './carousel-types';

export async function realignWithGemini(
  headline: string,
  body: string,
  imageBase64: string,
  imagePosition: { x: number; y: number; width: number; height: number }
): Promise<VisionLayoutDecision> {
  console.log('[Gemini Vision] 🤖 Starting Gemini 3 Flash-based layout decision...');
  console.log('[Gemini Vision] 📝 Headline length:', headline.length, 'chars');
  console.log('[Gemini Vision] 📝 Body length:', body.length, 'chars');
  console.log('[Gemini Vision] 🖼️ Image position:', imagePosition);
  console.log('[Gemini Vision] 📏 Image base64 length:', imageBase64.length, 'chars');

  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error('[Gemini Vision] ❌ GOOGLE_AI_API_KEY is not configured');
    throw new Error('Google AI API key is not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  
  // Use Gemini 3 Flash for fast, cost-effective reasoning
  // Gemini 3 Flash: $0.50/1M input tokens, $3/1M output tokens
  // Context: 1M input / 64k output, Knowledge cutoff: Jan 2025
  const modelName = 'gemini-3-flash-preview';
  console.log('[Gemini Vision] 🔑 Using model:', modelName);
  console.log('[Gemini Vision] ⚡ With thinking level: low (optimized for layout tasks)');
  
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: {
      temperature: 1.0, // Gemini 3 default (recommended by Google docs)
      topP: 0.95,
      topK: 40,
    },
  });

  const prompt = `Create a text layout for a 1080x1440px social media carousel.

Return ONLY valid JSON. No markdown, no explanation.

IMAGE POSITION: x=${imagePosition.x}, y=${imagePosition.y}, size=${imagePosition.width}x${imagePosition.height}
HEADLINE: "${headline}"
BODY: "${body}"

RULES:
- 40px margins on all edges
- Text center-aligned (x=540)
- Place text in empty white space with 120px clearance from image
- Headlines: 64-84px, Body: 42-56px
- Bold 2-3 key medical terms per line
- Max 15 chars/line for 72px font, 22 chars/line for 48px
- 100-130px spacing between lines

JSON structure:
{
  "canvas": { "width": 1080, "height": 1440 },
  "textLines": [
    {
      "text": "Line of text here",
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

  // Extract base64 data without prefix
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const maxAttempts = 3;
  let lastResponseText = '';

  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    console.log(`[Gemini Vision] 🔄 Attempt ${attempts}/${maxAttempts}`);

    try {
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: 'image/png',
              },
            },
          ],
        }],
        generationConfig: {
          temperature: 1.0,
          topP: 0.95,
          topK: 40,
        },
        // Use low thinking level for fast layout tasks
        // This minimizes latency while still providing quality spatial reasoning
        safetySettings: undefined, // Use defaults
      } as any);

      const response = await result.response;
      const text = response.text();
      
      lastResponseText = text;
      console.log('[Gemini Vision] 📨 Response received');
      console.log('[Gemini Vision] 📄 Raw response (first 200 chars):', text.substring(0, 200));

      // Clean up response - remove markdown code blocks if present
      let cleaned = text.trim();
      
      // Remove markdown code blocks
      cleaned = cleaned.replace(/^```json\n?/gm, '').replace(/^```\n?/gm, '').replace(/```$/gm, '');
      
      // Try to extract JSON if Gemini added explanatory text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
        console.log('[Gemini Vision] 🔍 Extracted JSON from response');
      }

      console.log('[Gemini Vision] 🧹 Cleaned response (first 200 chars):', cleaned.substring(0, 200));

      // Parse JSON
      const layout = JSON.parse(cleaned) as VisionLayoutDecision;
      
      // Validate structure
      if (!layout.textLines || !Array.isArray(layout.textLines)) {
        throw new Error('Invalid layout: missing textLines array');
      }

      if (layout.textLines.length === 0) {
        throw new Error('Invalid layout: no text lines provided');
      }

      console.log('[Gemini Vision] ✅ Layout parsed successfully');
      console.log('[Gemini Vision] 📊 Text lines:', layout.textLines.length);
      console.log('[Gemini Vision] 📐 First line:', {
        text: layout.textLines[0].text.substring(0, 50),
        size: layout.textLines[0].baseSize,
        position: layout.textLines[0].position,
        stylesCount: layout.textLines[0].styles.length,
      });

      return layout;
    } catch (error) {
      console.error(`[Gemini Vision] ❌ Attempt ${attempts} failed:`, error);
      
      if (attempts >= maxAttempts) {
        console.error('[Gemini Vision] ❌ All attempts exhausted');
        console.error('[Gemini Vision] 📄 Last response received (first 500 chars):', lastResponseText.substring(0, 500));
        throw new Error(`Failed to realign layout with Gemini after ${maxAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      console.log('[Gemini Vision] 🔄 Retrying...');
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }

  throw new Error('Failed to realign text layout with Gemini');
}

