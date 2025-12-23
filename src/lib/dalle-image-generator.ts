import 'server-only';

export async function generateMedicalImage(prompt: string): Promise<string> {
  const startTime = Date.now();
  console.log('[DALL-E] 🎨 Starting image generation...');
  console.log('[DALL-E] ⏰ Start time:', new Date().toLocaleTimeString());
  
  // CRITICAL: Ensure no text is generated in the image
  const noTextPrompt = `${prompt}

CRITICAL REQUIREMENTS:
- NO TEXT, NO LABELS, NO LETTERS, NO WORDS in the image
- Pure visual illustration only
- Text will be added separately by the design system
- Focus on visual medical illustration without any typography`;

  console.log('[DALL-E] 📝 Full prompt:', noTextPrompt);
  console.log('[DALL-E] 📏 Prompt length:', noTextPrompt.length, 'characters');
  console.log('[DALL-E] 🔑 API key configured:', !!process.env.OPENAI_API_KEY);
  console.log('[DALL-E] 🔑 API key prefix:', process.env.OPENAI_API_KEY?.substring(0, 20) + '...');

  const requestBody = {
    model: 'dall-e-3',
    prompt: noTextPrompt,
    n: 1,
    size: '1024x1024', // 1024x1024 size
    quality: 'hd', // HD QUALITY for better fidelity and detail
    style: 'natural', // Natural style for professional medical aesthetic
  };

  console.log('[DALL-E] 📤 Request config:', {
    model: requestBody.model,
    size: requestBody.size,
    quality: requestBody.quality,
    style: requestBody.style,
  });

  try {
    console.log('[DALL-E] 📡 Sending request to OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    const elapsed = Date.now() - startTime;
    console.log('[DALL-E] ⏱️ Response received after', elapsed, 'ms');
    console.log('[DALL-E] 📊 Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[DALL-E] ❌ API error response:', JSON.stringify(errorData, null, 2));
      console.error('[DALL-E] ❌ Status code:', response.status);
      throw new Error(`DALL-E API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('[DALL-E] 📦 Response data keys:', Object.keys(data));
    console.log('[DALL-E] 📦 Number of images:', data.data?.length || 0);

    const imageUrl = data.data[0]?.url;
    const revisedPrompt = data.data[0]?.revised_prompt;

    if (!imageUrl) {
      console.error('[DALL-E] ❌ No image URL in response:', data);
      throw new Error('No image URL in DALL-E response');
    }

    console.log('[DALL-E] ✅ Image generated successfully');
    console.log('[DALL-E] ⏱️ Total time:', Date.now() - startTime, 'ms');
    console.log('[DALL-E] ==========================================');
    console.log('[DALL-E] 🔗 IMAGE URL:', imageUrl);
    console.log('[DALL-E] ==========================================');
    if (revisedPrompt) {
      console.log('[DALL-E] 📝 Revised prompt:', revisedPrompt);
    }

    // Download the image and convert to base64 to avoid CORS issues
    console.log('[DALL-E] 📥 Downloading image to convert to base64...');
    try {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        console.error('[DALL-E] ❌ Failed to download image:', imageResponse.status);
        throw new Error('Failed to download image');
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBase64 = Buffer.from(imageBuffer).toString('base64');
      const dataUrl = `data:image/png;base64,${imageBase64}`;
      
      console.log('[DALL-E] ✅ Image converted to base64');
      console.log('[DALL-E] 📊 Base64 length:', imageBase64.length, 'characters');
      console.log('[DALL-E] 📊 Data URL length:', dataUrl.length, 'characters');
      
      return dataUrl;
    } catch (downloadError) {
      console.error('[DALL-E] ❌ Failed to convert image to base64:', downloadError);
      console.error('[DALL-E] ⚠️ Falling back to original URL (may have CORS issues)');
      return imageUrl;
    }
  } catch (error) {
    console.error('[DALL-E] ❌ Image generation failed:', error);
    throw error;
  }
}

export function createMedicalImagePrompt(headline: string, body: string): string {
  console.log('[DALL-E] 📋 Auto-generating image prompt...');
  console.log('[DALL-E] 📝 From headline:', headline.substring(0, 50) + '...');
  console.log('[DALL-E] 📝 From body:', body.substring(0, 50) + '...');
  
  // Create a detailed prompt for medical/health illustration (NO TEXT)
  const prompt = `Create a professional, clean medical illustration for a health education social media post.

Topic: ${headline}
Context: ${body.substring(0, 200)}

Style Requirements:
- Modern, minimalist medical illustration
- Clean white or very light neutral background
- Professional medical/anatomical aesthetic
- Suitable for Instagram/LinkedIn carousel
- Educational and trustworthy visual style
- High quality, photorealistic where appropriate

CRITICAL - NO TEXT IN IMAGE:
- Do NOT include any text, labels, words, letters, or typography
- Do NOT add captions, titles, or annotations
- Pure visual illustration only - text will be added separately
- Focus entirely on the visual medical concept
- Image should be self-explanatory without text`;

  console.log('[DALL-E] ✅ Auto-generated prompt (length:', prompt.length, 'chars)');
  console.log('[DALL-E] 📋 Full prompt:', prompt);
  return prompt;
}

