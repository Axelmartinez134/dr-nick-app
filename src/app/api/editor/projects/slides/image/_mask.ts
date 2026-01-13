import 'server-only';
import { PNG } from 'pngjs';

function binToB64(u8: Uint8Array) {
  return Buffer.from(u8).toString('base64');
}

export function computeAlphaMask128FromPngBytes(
  pngBytes: Uint8Array,
  alphaThreshold = 32,
  outW = 128,
  outH = 128
): { w: number; h: number; dataB64: string; alphaThreshold: number } {
  const decoded = PNG.sync.read(Buffer.from(pngBytes));
  const srcW = Math.max(1, decoded.width | 0);
  const srcH = Math.max(1, decoded.height | 0);
  const src = decoded.data; // RGBA

  const out = new Uint8Array(outW * outH);
  for (let oy = 0; oy < outH; oy++) {
    const sy = Math.min(srcH - 1, Math.floor((oy / outH) * srcH));
    for (let ox = 0; ox < outW; ox++) {
      const sx = Math.min(srcW - 1, Math.floor((ox / outW) * srcW));
      const si = (sy * srcW + sx) * 4;
      const a = src[si + 3] || 0;
      out[oy * outW + ox] = a > alphaThreshold ? 1 : 0;
    }
  }

  return { w: outW, h: outH, dataB64: binToB64(out), alphaThreshold };
}

export function pngHasAnyTransparency(pngBytes: Uint8Array): boolean {
  try {
    const decoded = PNG.sync.read(Buffer.from(pngBytes));
    const src = decoded.data;
    // Any alpha < 255 implies transparency exists somewhere.
    for (let i = 3; i < src.length; i += 4) {
      if ((src[i] || 0) < 255) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

