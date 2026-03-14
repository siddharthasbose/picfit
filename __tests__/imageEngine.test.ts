/**
 * Image engine tests using sharp (Node.js compatible).
 * Tests the core binary search compression algorithm.
 * Matches the Pica browser engine behavior:
 * - Signature: process at source res, threshold at 140
 * - Date stamp: single line "Name | Date", 12% height
 * - Binary search: maximize quality under maxKB
 */

import sharp from "sharp";
import * as path from "path";
import * as fs from "fs";

const PHOTO = path.join(__dirname, "../public/test-samples/sample-photo.jpg");
const SIG = path.join(__dirname, "../public/test-samples/sample-signature.png");

/**
 * Process signature: flatten → detect dark bg → invert → threshold at 140.
 * Process at source resolution BEFORE resize (matches Pica browser).
 */
async function processSignature(inputBuf: Buffer, width: number, height: number): Promise<Buffer> {
  // Step 1: Flatten to white bg (handles PNG transparency)
  const flatBuf = await sharp(inputBuf)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toBuffer();

  // Step 2: Detect dark background on flattened source
  const { data, info } = await sharp(flatBuf)
    .resize(50, 50, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let darkPixels = 0, totalPixels = 0;
  const w = info.width, h = info.height, ch = info.channels;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y === 0 || y === h - 1 || x === 0 || x === w - 1) {
        const idx = (y * w + x) * ch;
        if (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2] < 128) darkPixels++;
        totalPixels++;
      }
    }
  }
  const needsInvert = darkPixels / totalPixels > 0.5;

  // Step 3: Process at source resolution — grayscale → invert → threshold at 140
  let pipeline = sharp(flatBuf).grayscale();
  if (needsInvert) pipeline = pipeline.negate({ alpha: false });
  const processedBuf = await pipeline
    .threshold(140)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toBuffer();

  // Step 4: Resize AFTER processing — CONTAIN mode (never crop sigs)
  return sharp(processedBuf)
    .resize(width, height, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255 },
    })
    .sharpen({ sigma: 0.8 })
    .toBuffer();
}

/**
 * Process and compress an image to target KB range.
 */
async function processImage(
  inputPath: string,
  opts: {
    targetWidth: number; targetHeight: number;
    minKB: number; maxKB: number;
    bgColor: string | null;
    signatureMode?: boolean;
    dateStamp?: { name: string; date: string };
  }
) {
  const inputBuf = fs.readFileSync(inputPath);
  let processedBuf: Buffer;

  if (opts.signatureMode) {
    processedBuf = await processSignature(inputBuf, opts.targetWidth, opts.targetHeight);
  } else {
    const meta = await sharp(inputBuf).metadata();
    const srcW = meta.width || opts.targetWidth;
    const srcH = meta.height || opts.targetHeight;
    const downscaleRatio = Math.max(srcW / opts.targetWidth, srcH / opts.targetHeight);

    let sigma: number, m1: number, m2: number;
    if (downscaleRatio <= 1.5) {
      sigma = 0.5; m1 = 0.5; m2 = 5;
    } else if (downscaleRatio <= 3) {
      sigma = 1.0; m1 = 0.8; m2 = 8;
    } else if (downscaleRatio <= 6) {
      sigma = 1.3; m1 = 1.0; m2 = 10;
    } else {
      sigma = 1.2; m1 = 1.4; m2 = 14;
    }

    processedBuf = await sharp(inputBuf)
      .resize(opts.targetWidth, opts.targetHeight, { fit: "cover", position: "north" })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .modulate({ brightness: 1.02, saturation: 1.05 })
      .sharpen({ sigma, m1, m2 })
      .toBuffer();
  }

  let finalHeight = opts.targetHeight;
  if (opts.dateStamp) {
    // Single line date stamp: "Name | Date", height = 12% of target
    const stampHeight = Math.max(16, Math.round(opts.targetHeight * 0.12));
    finalHeight = opts.targetHeight + stampHeight;
    const label = `${opts.dateStamp.name} | ${opts.dateStamp.date}`;
    // Auto-fit font: shrink if text overflows width (avg char ≈ 0.6 * fontSize)
    const padding = 4;
    const maxTextWidth = opts.targetWidth - padding * 2;
    let fontSize = Math.max(6, Math.round(stampHeight * 0.45));
    while (fontSize > 5 && label.length * fontSize * 0.6 > maxTextWidth) fontSize--;
    const svg = Buffer.from(`
      <svg width="${opts.targetWidth}" height="${stampHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${opts.targetWidth}" height="${stampHeight}" fill="white"/>
        <text x="${opts.targetWidth / 2}" y="${stampHeight / 2}" font-family="Arial" font-size="${fontSize}" font-weight="bold" fill="black" text-anchor="middle" dominant-baseline="central">${label}</text>
      </svg>
    `);
    processedBuf = await sharp(processedBuf)
      .extend({ bottom: stampHeight, background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .composite([{ input: svg, top: opts.targetHeight, left: 0 }])
      .toBuffer();
  }

  // Binary search for HIGHEST quality that fits under maxKB
  let lo = 5, hi = 100;
  let bestBuf: Buffer = Buffer.alloc(0), bestQ = 95, bestKB = 0;

  for (let i = 0; i < 25; i++) {
    const mid = Math.ceil((lo + hi) / 2);
    const buf = await sharp(processedBuf).jpeg({ quality: mid, chromaSubsampling: "4:4:4" }).toBuffer();
    const kb = Math.round(buf.length / 1024);
    if (kb <= opts.maxKB) {
      bestBuf = buf; bestKB = kb; bestQ = mid;
      lo = mid;
    } else {
      hi = mid - 1;
    }
    if (lo >= hi) break;
  }
  if (bestBuf.length === 0) {
    bestBuf = await sharp(processedBuf).jpeg({ quality: lo, chromaSubsampling: "4:4:4" }).toBuffer();
    bestKB = Math.round(bestBuf.length / 1024); bestQ = lo;
  }

  const meta = await sharp(bestBuf).metadata();
  return { buffer: bestBuf, sizeKB: bestKB, width: meta.width!, height: meta.height!, quality: bestQ };
}

describe("imageEngine", () => {
  test("SSC photo: 413x531 → 100x120, <=50KB", async () => {
    const r = await processImage(PHOTO, { targetWidth: 100, targetHeight: 120, minKB: 1, maxKB: 50, bgColor: "#FFFFFF" });
    expect(r.width).toBe(100);
    expect(r.height).toBe(120);
    expect(r.sizeKB).toBeGreaterThanOrEqual(1);
    expect(r.sizeKB).toBeLessThanOrEqual(50);
  });

  test("UPSC photo: → 350x350, 30-100KB", async () => {
    const r = await processImage(PHOTO, { targetWidth: 350, targetHeight: 350, minKB: 30, maxKB: 100, bgColor: "#FFFFFF" });
    expect(r.width).toBe(350);
    expect(r.height).toBe(350);
    expect(r.sizeKB).toBeGreaterThanOrEqual(30);
    expect(r.sizeKB).toBeLessThanOrEqual(100);
  });

  test("IBPS photo: → 200x230, 20-50KB", async () => {
    const r = await processImage(PHOTO, { targetWidth: 200, targetHeight: 230, minKB: 20, maxKB: 50, bgColor: "#FFFFFF" });
    expect(r.sizeKB).toBeGreaterThanOrEqual(20);
    expect(r.sizeKB).toBeLessThanOrEqual(50);
  });

  test("Passport India: → 413x531, 20-300KB", async () => {
    const r = await processImage(PHOTO, { targetWidth: 413, targetHeight: 531, minKB: 20, maxKB: 300, bgColor: "#FFFFFF" });
    expect(r.width).toBe(413);
    expect(r.height).toBe(531);
    expect(r.sizeKB).toBeLessThanOrEqual(300);
  });

  test("PAN Card photo: → 132x170, <=50KB", async () => {
    const r = await processImage(PHOTO, { targetWidth: 132, targetHeight: 170, minKB: 1, maxKB: 50, bgColor: "#FFFFFF" });
    expect(r.width).toBe(132);
    expect(r.height).toBe(170);
    expect(r.sizeKB).toBeLessThanOrEqual(50);
  });

  test("SSC signature: → 140x60, <=20KB, white bg", async () => {
    const r = await processImage(SIG, { targetWidth: 140, targetHeight: 60, minKB: 1, maxKB: 20, bgColor: null, signatureMode: true });
    expect(r.width).toBe(140);
    expect(r.height).toBe(60);
    expect(r.sizeKB).toBeLessThanOrEqual(20);
  });

  test("PAN Card signature: → 170x76, <=50KB", async () => {
    const r = await processImage(SIG, { targetWidth: 170, targetHeight: 76, minKB: 1, maxKB: 50, bgColor: null, signatureMode: true });
    expect(r.sizeKB).toBeLessThanOrEqual(50);
  });

  test("Date stamp: single-line format, 12% height", async () => {
    const r = await processImage(PHOTO, {
      targetWidth: 100, targetHeight: 120, minKB: 1, maxKB: 50,
      bgColor: "#FFFFFF",
      dateStamp: { name: "Siddhartha Bose", date: "11/03/2026" },
    });
    // Stamp height = max(16, round(120 * 0.12)) = max(16, 14) = 16
    // Total height = 120 + 16 = 136
    expect(r.height).toBe(136);
    expect(r.sizeKB).toBeLessThanOrEqual(50);
  });

  test("UPSC date stamp: 350x350 + stamp", async () => {
    const r = await processImage(PHOTO, {
      targetWidth: 350, targetHeight: 350, minKB: 30, maxKB: 100,
      bgColor: "#FFFFFF",
      dateStamp: { name: "Siddhartha Bose", date: "11/03/2026" },
    });
    // Stamp height = max(16, round(350 * 0.12)) = max(16, 42) = 42
    // Total height = 350 + 42 = 392
    expect(r.height).toBe(392);
    expect(r.sizeKB).toBeLessThanOrEqual(100);
  });

  test("Signature dark bg → white corners after processing", async () => {
    const r = await processImage(SIG, { targetWidth: 140, targetHeight: 60, minKB: 1, maxKB: 20, bgColor: null, signatureMode: true });
    const { data } = await sharp(r.buffer).raw().toBuffer({ resolveWithObject: true });
    // Top-left corner should be white (background)
    expect(data[0]).toBeGreaterThan(200); // R
    expect(data[1]).toBeGreaterThan(200); // G
    expect(data[2]).toBeGreaterThan(200); // B
  });

  test("Large synthetic image (4000x3000) handled", async () => {
    const buf = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).jpeg().toBuffer();

    const tmpPath = path.join(__dirname, "../test-output/large_test.jpg");
    if (!fs.existsSync(path.dirname(tmpPath))) fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
    fs.writeFileSync(tmpPath, buf);

    const r = await processImage(tmpPath, { targetWidth: 200, targetHeight: 230, minKB: 1, maxKB: 50, bgColor: "#FFFFFF" });
    expect(r.width).toBe(200);
    expect(r.height).toBe(230);

    fs.unlinkSync(tmpPath);
  });
});
