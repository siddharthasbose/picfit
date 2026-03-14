/**
 * Core image processing engine using Pica (Lanczos3 resampling).
 * All processing happens client-side — zero server calls.
 *
 * v4 fixes:
 * - Signatures: FIT mode (contain + white pad) — never crops
 * - Photos: top-biased COVER crop — keeps head, crops bottom
 * - Much stronger unsharp for crisp output at all sizes
 * - Multi-pass resize for extreme downscales (>4x)
 */

import Pica from "pica";

const pica = new Pica();

export interface ProcessOptions {
  targetWidth: number;
  targetHeight: number;
  minKB: number;
  maxKB: number;
  bgColor: string | null;
  format: "jpeg" | "png";
  dateStamp?: {
    name: string;
    date: string;
  };
  signatureMode?: boolean;
}

export interface ProcessResult {
  dataUrl: string;
  blob: Blob;
  sizeKB: number;
  width: number;
  height: number;
  quality: number;
  withinRange: boolean;
  format: string;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Draw source image onto a canvas for PHOTOS.
 * Top-biased COVER crop: keeps head, crops from bottom.
 */
function drawPhotoCropped(
  img: HTMLImageElement,
  targetAspect: number
): HTMLCanvasElement {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const srcAspect = srcW / srcH;

  let cropX = 0, cropY = 0, cropW = srcW, cropH = srcH;

  if (srcAspect > targetAspect) {
    // Source wider — crop sides (center)
    cropW = Math.round(srcH * targetAspect);
    cropX = Math.round((srcW - cropW) / 2);
  } else {
    // Source taller — crop bottom (keep head at top)
    cropH = Math.round(srcW / targetAspect);
    // Top-biased: only crop 20% from top, rest from bottom
    cropY = Math.round((srcH - cropH) * 0.20);
  }

  const c = makeCanvas(cropW, cropH);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return c;
}

/**
 * Draw source image onto a canvas for SIGNATURES.
 * FIT mode (contain): scales to fit entirely, white padding around edges.
 * Never crops — the full signature is always visible.
 */
function drawSignatureFit(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  // Scale to fit within target (contain mode)
  const scale = Math.min(targetWidth / srcW, targetHeight / srcH);
  const drawW = Math.round(srcW * scale);
  const drawH = Math.round(srcH * scale);

  // Create canvas at SOURCE scaled size (we'll pad to target after resize)
  // Actually, draw full source onto a canvas that maintains its aspect ratio
  // then pad to exact target after processing
  const c = makeCanvas(srcW, srcH);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return c;
}

/**
 * Flatten PNG transparency to white background.
 */
function flattenToWhite(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    data[i] = Math.round(data[i] * a + 255 * (1 - a));
    data[i + 1] = Math.round(data[i + 1] * a + 255 * (1 - a));
    data[i + 2] = Math.round(data[i + 2] * a + 255 * (1 - a));
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Detect dark background by sampling edge pixels.
 */
function isDarkBackground(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  const sampleSize = Math.max(5, Math.min(20, Math.floor(w * 0.05)));

  const regions: [number, number][] = [
    [0, 0],
    [w - sampleSize, 0],
    [0, h - sampleSize],
    [w - sampleSize, h - sampleSize],
  ];

  let darkPixels = 0;
  let totalPixels = 0;

  for (const [x, y] of regions) {
    const data = ctx.getImageData(x, y, sampleSize, sampleSize).data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (gray < 128) darkPixels++;
      totalPixels++;
    }
  }

  return darkPixels / totalPixels > 0.5;
}

/**
 * Process signature at SOURCE resolution before resize.
 * Flatten → detect dark bg → invert if needed → threshold at 140.
 */
function processSignatureOnSource(canvas: HTMLCanvasElement): void {
  flattenToWhite(canvas);
  const needsInvert = isDarkBackground(canvas);

  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (needsInvert) gray = 255 - gray;
    const val = gray < 140 ? 0 : 255;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Multi-pass Pica resize for extreme downscales.
 * If ratio > 4x, first resize to 2x target, then to target.
 * Produces sharper results than a single huge downscale.
 */
async function picaResizeMultiPass(
  src: HTMLCanvasElement,
  targetW: number,
  targetH: number,
  unsharpAmount: number,
  unsharpRadius: number,
  unsharpThreshold: number
): Promise<HTMLCanvasElement> {
  const srcW = src.width;
  const srcH = src.height;
  const ratio = Math.max(srcW / targetW, srcH / targetH);

  if (ratio > 4) {
    // First pass: resize to 2x target
    const midW = targetW * 2;
    const midH = targetH * 2;
    const midCanvas = makeCanvas(midW, midH);
    await pica.resize(src, midCanvas, {
      unsharpAmount: Math.round(unsharpAmount * 0.5),
      unsharpRadius: unsharpRadius * 0.5,
      unsharpThreshold,
      alpha: false,
    });

    // Second pass: resize to target with full unsharp
    const destCanvas = makeCanvas(targetW, targetH);
    await pica.resize(midCanvas, destCanvas, {
      unsharpAmount,
      unsharpRadius,
      unsharpThreshold,
      alpha: false,
    });
    return destCanvas;
  }

  // Single pass
  const destCanvas = makeCanvas(targetW, targetH);
  await pica.resize(src, destCanvas, {
    unsharpAmount,
    unsharpRadius,
    unsharpThreshold,
    alpha: false,
  });
  return destCanvas;
}

/**
 * Draw date stamp strip.
 * Single line: "Name | Date", bold, auto-fit font to width.
 */
function drawDateStamp(
  ctx: CanvasRenderingContext2D,
  width: number,
  yOffset: number,
  stampHeight: number,
  name: string,
  date: string
): void {
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, yOffset, width, stampHeight);

  const label = `${name} | ${date}`;
  const padding = 4;
  const maxTextWidth = width - padding * 2;

  let fontSize = Math.max(6, Math.round(stampHeight * 0.45));
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  let textWidth = ctx.measureText(label).width;

  while (textWidth > maxTextWidth && fontSize > 5) {
    fontSize--;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    textWidth = ctx.measureText(label).width;
  }

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, width / 2, yOffset + stampHeight / 2);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Main image processing function.
 */
export async function processImage(
  sourceImage: HTMLImageElement,
  options: ProcessOptions
): Promise<ProcessResult> {
  const { targetWidth, targetHeight, minKB, maxKB, format, dateStamp, signatureMode } = options;

  const stampHeight = dateStamp
    ? Math.max(16, Math.round(targetHeight * 0.12))
    : 0;
  const totalHeight = targetHeight + stampHeight;

  let destCanvas: HTMLCanvasElement;

  if (signatureMode) {
    // === SIGNATURE PIPELINE ===
    // 1. Draw full source (no crop)
    const srcCanvas = drawSignatureFit(sourceImage, targetWidth, targetHeight);

    // 2. Process at source resolution (flatten, threshold)
    processSignatureOnSource(srcCanvas);

    // 3. Resize processed signature to FIT within target (contain mode)
    const srcW = srcCanvas.width;
    const srcH = srcCanvas.height;
    const scale = Math.min(targetWidth / srcW, targetHeight / srcH);
    const fitW = Math.round(srcW * scale);
    const fitH = Math.round(srcH * scale);

    // Resize to fitted dimensions
    const fitCanvas = makeCanvas(fitW, fitH);
    await pica.resize(srcCanvas, fitCanvas, {
      unsharpAmount: 200,
      unsharpRadius: 0.8,
      unsharpThreshold: 1,
      alpha: false,
    });

    // 4. Center on white target canvas (pad)
    destCanvas = makeCanvas(targetWidth, targetHeight);
    const ctx = destCanvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    const offsetX = Math.round((targetWidth - fitW) / 2);
    const offsetY = Math.round((targetHeight - fitH) / 2);
    ctx.drawImage(fitCanvas, offsetX, offsetY);

  } else {
    // === PHOTO PIPELINE ===
    // 1. Top-biased crop at source resolution
    const targetAspect = targetWidth / targetHeight;
    const srcCanvas = drawPhotoCropped(sourceImage, targetAspect);
    flattenToWhite(srcCanvas);

    // 2. Multi-pass resize with adaptive unsharp based on downscale ratio
    const srcW = srcCanvas.width;
    const srcH = srcCanvas.height;
    const downscaleRatio = Math.max(srcW / targetWidth, srcH / targetHeight);

    // Heavier downscale = more aggressive sharpening.
    // Tuned for tiny exam targets (e.g. 100x120) to preserve edge clarity.
    let unsharpAmount: number, unsharpRadius: number;
    if (downscaleRatio <= 1.5) {
      // Minimal resize — light sharpen to preserve original detail
      unsharpAmount = 80;
      unsharpRadius = 0.4;
    } else if (downscaleRatio <= 3) {
      unsharpAmount = 160;
      unsharpRadius = 0.8;
    } else if (downscaleRatio <= 6) {
      unsharpAmount = 260;
      unsharpRadius = 0.9;
    } else {
      // Extreme downscale (>6x) — stronger, slightly tighter radius
      unsharpAmount = 320;
      unsharpRadius = 0.8;
    }

    destCanvas = await picaResizeMultiPass(
      srcCanvas, targetWidth, targetHeight,
      unsharpAmount, unsharpRadius, 2
    );
  }

  // Date stamp
  let finalCanvas: HTMLCanvasElement;
  if (dateStamp) {
    finalCanvas = makeCanvas(targetWidth, totalHeight);
    const ctx = finalCanvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, targetWidth, totalHeight);
    ctx.drawImage(destCanvas, 0, 0);
    drawDateStamp(ctx, targetWidth, targetHeight, stampHeight, dateStamp.name, dateStamp.date);
  } else {
    finalCanvas = destCanvas;
  }

  // Binary search for HIGHEST quality ≤ maxKB
  let bestBlob: Blob | null = null;
  let bestDataUrl = "";
  let bestSizeKB = 0;
  let bestQuality = 0.95;

  if (format === "png") {
    bestBlob = await pica.toBlob(finalCanvas, "image/png", 0);
    bestDataUrl = await blobToDataUrl(bestBlob);
    bestSizeKB = Math.round(bestBlob.size / 1024);
    bestQuality = 1.0;
  } else {
    let lo = 0.05;
    let hi = 0.99;

    for (let i = 0; i < 25; i++) {
      const mid = (lo + hi) / 2;
      const blob = await pica.toBlob(finalCanvas, "image/jpeg", mid);
      const sizeKB = Math.round(blob.size / 1024);

      if (sizeKB <= maxKB) {
        bestBlob = blob;
        bestSizeKB = sizeKB;
        bestQuality = mid;
        lo = mid;
      } else {
        hi = mid;
      }

      if (hi - lo < 0.005) break;
    }

    if (!bestBlob) {
      bestBlob = await pica.toBlob(finalCanvas, "image/jpeg", 0.05);
      bestSizeKB = Math.round(bestBlob.size / 1024);
      bestQuality = 0.05;
    }

    bestDataUrl = await blobToDataUrl(bestBlob);
  }

  return {
    dataUrl: bestDataUrl,
    blob: bestBlob!,
    sizeKB: bestSizeKB,
    width: targetWidth,
    height: totalHeight,
    quality: Math.round(bestQuality * 100),
    withinRange: bestSizeKB >= minKB && bestSizeKB <= maxKB,
    format: format === "png" ? "image/png" : "image/jpeg",
  };
}
