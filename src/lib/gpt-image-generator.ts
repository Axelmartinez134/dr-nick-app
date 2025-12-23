import 'server-only';

export async function generateMedicalImage(prompt: string): Promise<string> {
  const startTime = Date.now();
  console.log('[GPT-Image-1.5] 🎨 Starting image generation with GPT-Image-1.5...');
  console.log('[GPT-Image-1.5] ⏰ Start time:', new Date().toLocaleTimeString());
  
  // CRITICAL: Ensure no text is generated in the image
  const noTextPrompt = `${prompt}

CRITICAL REQUIREMENTS:
- NO TEXT, NO LABELS, NO LETTERS, NO WORDS in the image
- Pure visual illustration only
- Text will be added separately by the design system
- Focus on visual medical illustration without any typography
- High quality, professional medical aesthetic`;

  console.log('[GPT-Image-1.5] 📝 Full prompt:', noTextPrompt);
  console.log('[GPT-Image-1.5] 📏 Prompt length:', noTextPrompt.length, 'characters (max 32000)');
  console.log('[GPT-Image-1.5] 🔑 API key configured:', !!process.env.OPENAI_API_KEY);
  console.log('[GPT-Image-1.5] 🔑 API key prefix:', process.env.OPENAI_API_KEY?.substring(0, 20) + '...');

  const requestBody = {
    model: 'gpt-image-1.5',
    prompt: noTextPrompt,
    n: 1,
    size: '1024x1536', // Portrait format (1080x1440 will be scaled from this)
    quality: 'high', // High quality for best fidelity
    background: 'transparent', // Native transparent background - no Clipdrop needed!
    output_format: 'png', // PNG supports transparency
  };

  console.log('[GPT-Image-1.5] 📤 Request config:', {
    model: requestBody.model,
    size: requestBody.size,
    quality: requestBody.quality,
    background: requestBody.background,
    output_format: requestBody.output_format,
  });

  try {
    console.log('[GPT-Image-1.5] 📡 Sending request to OpenAI GPT-Image API...');
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    const elapsed = Date.now() - startTime;
    console.log('[GPT-Image-1.5] ⏱️ Response received after', elapsed, 'ms');
    console.log('[GPT-Image-1.5] 📊 Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[GPT-Image-1.5] ❌ API error response:', JSON.stringify(errorData, null, 2));
      console.error('[GPT-Image-1.5] ❌ Status code:', response.status);
      throw new Error(`GPT-Image API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('[GPT-Image-1.5] 📦 Response data keys:', Object.keys(data));
    console.log('[GPT-Image-1.5] 📦 Number of images:', data.data?.length || 0);
    console.log('[GPT-Image-1.5] 📊 Background:', data.background);
    console.log('[GPT-Image-1.5] 📊 Output format:', data.output_format);
    console.log('[GPT-Image-1.5] 📊 Quality:', data.quality);
    console.log('[GPT-Image-1.5] 📊 Size:', data.size);

    // GPT Image models always return base64-encoded images
    const imageBase64 = data.data[0]?.b64_json;
    if (!imageBase64) {
      console.error('[GPT-Image-1.5] ❌ No base64 image in response:', data);
      throw new Error('No image data returned from GPT-Image API');
    }

    console.log('[GPT-Image-1.5] ✅ Image generated successfully with transparent background');
    console.log('[GPT-Image-1.5] ⏱️ Total time:', Date.now() - startTime, 'ms');
    console.log('[GPT-Image-1.5] 📊 Base64 length:', imageBase64.length, 'characters');
    console.log('[GPT-Image-1.5] ==========================================');
    console.log('[GPT-Image-1.5] ✅ TRANSPARENT BACKGROUND - No Clipdrop needed!');
    console.log('[GPT-Image-1.5] ==========================================');

    // Return as data URL (already base64, just need to add prefix)
    const dataUrl = `data:image/png;base64,${imageBase64}`;
    console.log('[GPT-Image-1.5] 📊 Final data URL length:', dataUrl.length, 'characters');
    
    return dataUrl;
  } catch (error) {
    console.error('[GPT-Image-1.5] ❌ Image generation failed:', error);
    throw error;
  }
}

export function createMedicalImagePrompt(headline: string, body: string): string {
  console.log('[GPT-Image-1.5] 📋 Auto-generating image prompt...');
  console.log('[GPT-Image-1.5] 📝 From headline:', headline.substring(0, 50) + '...');
  console.log('[GPT-Image-1.5] 📝 From body:', body.substring(0, 50) + '...');
  
  // Create a detailed prompt for medical/health illustration (NO TEXT)
  const prompt = `Create a professional, clean medical illustration for a health education social media post.

Topic: ${headline}
Context: ${body.substring(0, 200)}

Style Requirements:
- Modern, minimalist medical illustration
- Clean transparent or very light neutral background
- Professional medical/anatomical aesthetic
- Suitable for Instagram/LinkedIn carousel (portrait format)
- Educational and trustworthy visual style
- High quality, photorealistic where appropriate
- Focus on clarity and professional presentation

CRITICAL - NO TEXT IN IMAGE:
- Do NOT include any text, labels, words, letters, or typography
- Do NOT add captions, titles, or annotations
- Pure visual illustration only - text will be added separately
- Focus entirely on the visual medical concept
- Image should be self-explanatory without text`;

  console.log('[GPT-Image-1.5] ✅ Auto-generated prompt (length:', prompt.length, 'chars)');
  console.log('[GPT-Image-1.5] 📋 Full prompt:', prompt);
  return prompt;
}

