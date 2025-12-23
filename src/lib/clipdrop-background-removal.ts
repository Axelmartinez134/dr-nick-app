import 'server-only';

export async function removeBackground(imageBase64: string): Promise<string> {
  const startTime = Date.now();
  console.log('[Clipdrop] 🎨 Starting background removal...');
  console.log('[Clipdrop] ⏰ Start time:', new Date().toLocaleTimeString());
  console.log('[Clipdrop] 📊 Input image size:', imageBase64.length, 'characters');

  if (!process.env.CLIPDROP_API_KEY) {
    console.error('[Clipdrop] ❌ CLIPDROP_API_KEY is not configured.');
    throw new Error('Clipdrop API key is not configured.');
  }

  console.log('[Clipdrop] 🔑 API key configured:', !!process.env.CLIPDROP_API_KEY);

  try {
    // Convert base64 to buffer
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    console.log('[Clipdrop] 📦 Image buffer size:', imageBuffer.length, 'bytes');

    // Create form data
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('image_file', blob, 'image.png');

    console.log('[Clipdrop] 📡 Sending request to Clipdrop API...');
    
    const response = await fetch('https://clipdrop-api.co/remove-background/v1', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CLIPDROP_API_KEY,
      },
      body: formData,
    });

    const elapsed = Date.now() - startTime;
    console.log('[Clipdrop] ⏱️ Response received after', elapsed, 'ms');
    console.log('[Clipdrop] 📊 Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Clipdrop] ❌ API error response:', errorText);
      console.error('[Clipdrop] ❌ Status code:', response.status);
      throw new Error(`Clipdrop API error: ${response.status} ${response.statusText}`);
    }

    // Get the result as buffer
    const resultBuffer = await response.arrayBuffer();
    console.log('[Clipdrop] 📦 Result buffer size:', resultBuffer.byteLength, 'bytes');

    // Convert to base64
    const resultBase64 = Buffer.from(resultBuffer).toString('base64');
    const dataUrl = `data:image/png;base64,${resultBase64}`;

    console.log('[Clipdrop] ✅ Background removed successfully');
    console.log('[Clipdrop] ⏱️ Total time:', Date.now() - startTime, 'ms');
    console.log('[Clipdrop] 📊 Output size:', resultBase64.length, 'characters');
    console.log('[Clipdrop] ==========================================');
    console.log('[Clipdrop] ✅ Background removal complete');
    console.log('[Clipdrop] ==========================================');

    return dataUrl;
  } catch (error: any) {
    console.error('[Clipdrop] ❌ Background removal failed:', error);
    if (error.response) {
      console.error('[Clipdrop] ❌ Error response:', error.response);
    }
    throw new Error(`Failed to remove background: ${error.message || 'Unknown error'}`);
  }
}

