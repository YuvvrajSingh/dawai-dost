/**
 * Real, on-device image quality check run before OCR.
 * Sharpness = variance of the Laplacian on a 320px grayscale downscale.
 * Brightness = mean luminance. Cheap enough for low-end Android (~5 ms).
 */
import type { ImageQuality } from "./types";

export async function assessImage(source: CanvasImageSource, w: number, h: number): Promise<ImageQuality> {
  const scale = 320 / Math.max(w, h);
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, cw, ch);
  const { data } = ctx.getImageData(0, 0, cw, ch);
  const g = new Float32Array(cw * ch);
  let lum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    g[p] = y;
    lum += y;
  }
  const brightness = lum / g.length;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < ch - 1; y++) {
    for (let x = 1; x < cw - 1; x++) {
      const i = y * cw + x;
      const l = g[i - cw] + g[i + cw] + g[i - 1] + g[i + 1] - 4 * g[i];
      sum += l;
      sumSq += l * l;
      n++;
    }
  }
  const mean = sum / Math.max(1, n);
  const sharpness = sumSq / Math.max(1, n) - mean * mean;
  const verdict: ImageQuality["verdict"] = brightness < 45 ? "dark" : brightness > 235 ? "bright" : sharpness < 60 ? "blurry" : "ok";
  return { sharpness, brightness, verdict };
}

export function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
