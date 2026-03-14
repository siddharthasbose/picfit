/**
 * Node.js validation script — processes test images through sharp
 * and saves outputs to test-output/ with a validation report.
 *
 * v3 fixes — matches browser Pica engine:
 * - Photos: TOP-BIASED crop (position: "north") — keeps head, crops chest
 * - Signatures: CENTER crop (position: "center")
 * - Date stamp: auto-fit font to width, single line "Name | Date"
 * - Stronger sharpening for small targets
 *
 * Run: npx tsx scripts/validate.ts
 */

import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

interface ProcessOptions {
  targetWidth: number;
  targetHeight: number;
  minKB: number;
  maxKB: number;
  bgColor: string | null;
  format: "jpeg" | "png";
  dateStamp?: { name: string; date: string };
  signatureMode?: boolean;
}

interface ProcessResult {
  buffer: Buffer;
  sizeKB: number;
  width: number;
  height: number;
  quality: number;
  withinRange: boolean;
}

/**
 * Process signature: flatten → detect dark bg → invert → threshold at 140.
 * Process at SOURCE resolution first, then resize.
 */
async function processSignature(inputBuf: Buffer, width: number, height: number): Promise<Buffer> {
  const flatBuf = await sharp(inputBuf)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toBuffer();

  // Detect dark background
  const { data: sampleData, info: sampleInfo } = await sharp(flatBuf)
    .resize(50, 50, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let darkPixels = 0, totalPixels = 0;
  const sw = sampleInfo.width, sh = sampleInfo.height, sch = sampleInfo.channels;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (y === 0 || y === sh - 1 || x === 0 || x === sw - 1) {
        const idx = (y * sw + x) * sch;
        const gray = 0.299 * sampleData[idx] + 0.587 * sampleData[idx + 1] + 0.114 * sampleData[idx + 2];
        if (gray < 128) darkPixels++;
        totalPixels++;
      }
    }
  }
  const needsInvert = darkPixels / totalPixels > 0.5;

  // Process at source resolution
  let pipeline = sharp(flatBuf).grayscale();
  if (needsInvert) pipeline = pipeline.negate({ alpha: false });
  const processedBuf = await pipeline
    .threshold(140)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toBuffer();

  // Resize AFTER processing — signatures use CONTAIN (fit + white pad)
  // Never crop a signature — show the full thing
  return sharp(processedBuf)
    .resize(width, height, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255 },
    })
    .sharpen({ sigma: 0.8 })
    .toBuffer();
}

/**
 * Create date stamp SVG — auto-fit font size to available width.
 * Single line: "Name | Date", height = 12% of target (min 16px).
 */
function createDateStampSVG(width: number, targetHeight: number, name: string, date: string): { svg: Buffer; height: number } {
  const stampHeight = Math.max(16, Math.round(targetHeight * 0.12));
  const label = `${name} | ${date}`;

  // Estimate text width and shrink font if needed
  // Average char width ≈ 0.6 * fontSize for Arial bold
  const padding = 4;
  const maxTextWidth = width - padding * 2;
  let fontSize = Math.max(6, Math.round(stampHeight * 0.45));

  while (fontSize > 5 && label.length * fontSize * 0.6 > maxTextWidth) {
    fontSize--;
  }

  const svg = Buffer.from(`
    <svg width="${width}" height="${stampHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${stampHeight}" fill="white"/>
      <text x="${width / 2}" y="${stampHeight / 2}" font-family="Arial" font-size="${fontSize}" font-weight="bold" fill="black" text-anchor="middle" dominant-baseline="central">${label}</text>
    </svg>
  `);

  return { svg, height: stampHeight };
}

/**
 * Main processing function using sharp.
 */
async function processImageSharp(
  inputPath: string,
  options: ProcessOptions
): Promise<ProcessResult> {
  const { targetWidth, targetHeight, minKB, maxKB, dateStamp, signatureMode } = options;

  const inputBuf = fs.readFileSync(inputPath);
  let processedBuf: Buffer;

  if (signatureMode) {
    processedBuf = await processSignature(inputBuf, targetWidth, targetHeight);
  } else {
    // Photo: TOP-BIASED crop, strong sharpening
    // Get source dimensions to determine downscale ratio
    const meta = await sharp(inputBuf).metadata();
    const srcW = meta.width || targetWidth;
    const srcH = meta.height || targetHeight;
    const downscaleRatio = Math.max(srcW / targetWidth, srcH / targetHeight);

    // Adaptive sharpening based on downscale ratio:
    // - Minimal resize (<=1.5x): light sharpen, preserve original detail
    // - Moderate (1.5-3x): medium sharpen
    // - Heavy (3-6x): stronger sharpen
    // - Extreme (>6x): strong + tighter radius for tiny targets
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
      .resize(targetWidth, targetHeight, { fit: "cover", position: "north" })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .modulate({ brightness: 1.02, saturation: 1.05 })
      .sharpen({ sigma, m1, m2 })
      .toBuffer();
  }

  // Date stamp
  let finalHeight = targetHeight;
  if (dateStamp) {
    const { svg, height: stampHeight } = createDateStampSVG(targetWidth, targetHeight, dateStamp.name, dateStamp.date);
    finalHeight = targetHeight + stampHeight;

    processedBuf = await sharp(processedBuf)
      .extend({
        bottom: stampHeight,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .composite([{
        input: svg,
        top: targetHeight,
        left: 0,
      }])
      .toBuffer();
  }

  // Binary search for HIGHEST quality ≤ maxKB
  let lo = 5;
  let hi = 100;
  let bestBuffer: Buffer = Buffer.alloc(0);
  let bestQuality = 95;
  let bestSizeKB = 0;

  for (let i = 0; i < 25; i++) {
    const mid = Math.ceil((lo + hi) / 2);
    const buf = await sharp(processedBuf)
      .jpeg({ quality: mid, chromaSubsampling: "4:4:4" })
      .toBuffer();
    const sizeKB = Math.round(buf.length / 1024);

    if (sizeKB <= maxKB) {
      bestBuffer = buf;
      bestSizeKB = sizeKB;
      bestQuality = mid;
      lo = mid;
    } else {
      hi = mid - 1;
    }

    if (lo >= hi) break;
  }

  if (bestBuffer.length === 0) {
    bestBuffer = await sharp(processedBuf)
      .jpeg({ quality: lo, chromaSubsampling: "4:4:4" })
      .toBuffer();
    bestSizeKB = Math.round(bestBuffer.length / 1024);
    bestQuality = lo;
  }

  return {
    buffer: bestBuffer!,
    sizeKB: bestSizeKB,
    width: targetWidth,
    height: finalHeight,
    quality: bestQuality,
    withinRange: bestSizeKB >= minKB && bestSizeKB <= maxKB,
  };
}

// ============= Test Cases =============

interface TestCase {
  name: string;
  inputFile: string;
  outputFile: string;
  options: ProcessOptions;
  expectedWidth: number;
  expectedMinHeight: number;
  expectedMinKB: number;
  expectedMaxKB: number;
}

const PHOTO_FILE = path.join(__dirname, "../public/test-samples/sample-photo.jpg");
const SIG_FILE = path.join(__dirname, "../public/test-samples/sample-signature.png");
const OUTPUT_DIR = path.join(__dirname, "../test-output");

const testCases: TestCase[] = [
  {
    name: "SSC CGL Photo",
    inputFile: PHOTO_FILE,
    outputFile: "ssc_cgl_photo.jpg",
    options: { targetWidth: 100, targetHeight: 120, minKB: 1, maxKB: 50, bgColor: "#FFFFFF", format: "jpeg" },
    expectedWidth: 100, expectedMinHeight: 120, expectedMinKB: 1, expectedMaxKB: 50,
  },
  {
    name: "UPSC Photo",
    inputFile: PHOTO_FILE,
    outputFile: "upsc_photo.jpg",
    options: { targetWidth: 350, targetHeight: 350, minKB: 30, maxKB: 100, bgColor: "#FFFFFF", format: "jpeg" },
    expectedWidth: 350, expectedMinHeight: 350, expectedMinKB: 30, expectedMaxKB: 100,
  },
  {
    name: "IBPS Photo",
    inputFile: PHOTO_FILE,
    outputFile: "ibps_photo.jpg",
    options: { targetWidth: 200, targetHeight: 230, minKB: 20, maxKB: 50, bgColor: "#FFFFFF", format: "jpeg" },
    expectedWidth: 200, expectedMinHeight: 230, expectedMinKB: 20, expectedMaxKB: 50,
  },
  {
    name: "Passport India Photo",
    inputFile: PHOTO_FILE,
    outputFile: "passport_india_photo.jpg",
    options: { targetWidth: 413, targetHeight: 531, minKB: 20, maxKB: 300, bgColor: "#FFFFFF", format: "jpeg" },
    expectedWidth: 413, expectedMinHeight: 531, expectedMinKB: 20, expectedMaxKB: 300,
  },
  {
    name: "PAN Card Photo",
    inputFile: PHOTO_FILE,
    outputFile: "pan_card_photo.jpg",
    options: { targetWidth: 132, targetHeight: 170, minKB: 1, maxKB: 50, bgColor: "#FFFFFF", format: "jpeg" },
    expectedWidth: 132, expectedMinHeight: 170, expectedMinKB: 1, expectedMaxKB: 50,
  },
  {
    name: "SSC Photo + Date Stamp",
    inputFile: PHOTO_FILE,
    outputFile: "ssc_cgl_photo_stamped.jpg",
    options: {
      targetWidth: 100, targetHeight: 120, minKB: 1, maxKB: 50,
      bgColor: "#FFFFFF", format: "jpeg",
      dateStamp: { name: "Siddhartha Bose", date: "11/03/2026" },
    },
    expectedWidth: 100, expectedMinHeight: 121, expectedMinKB: 1, expectedMaxKB: 50,
  },
  {
    name: "UPSC Photo + Date Stamp",
    inputFile: PHOTO_FILE,
    outputFile: "upsc_photo_stamped.jpg",
    options: {
      targetWidth: 350, targetHeight: 350, minKB: 30, maxKB: 100,
      bgColor: "#FFFFFF", format: "jpeg",
      dateStamp: { name: "Siddhartha Bose", date: "11/03/2026" },
    },
    expectedWidth: 350, expectedMinHeight: 351, expectedMinKB: 30, expectedMaxKB: 100,
  },
  {
    name: "SSC Signature (dark bg)",
    inputFile: SIG_FILE,
    outputFile: "ssc_signature.jpg",
    options: { targetWidth: 140, targetHeight: 60, minKB: 1, maxKB: 20, bgColor: null, format: "jpeg", signatureMode: true },
    expectedWidth: 140, expectedMinHeight: 60, expectedMinKB: 1, expectedMaxKB: 20,
  },
  {
    name: "IBPS Signature (dark bg)",
    inputFile: SIG_FILE,
    outputFile: "ibps_signature.jpg",
    options: { targetWidth: 140, targetHeight: 60, minKB: 1, maxKB: 20, bgColor: null, format: "jpeg", signatureMode: true },
    expectedWidth: 140, expectedMinHeight: 60, expectedMinKB: 1, expectedMaxKB: 20,
  },
  {
    name: "PAN Card Signature",
    inputFile: SIG_FILE,
    outputFile: "pan_signature.jpg",
    options: { targetWidth: 170, targetHeight: 76, minKB: 1, maxKB: 50, bgColor: null, format: "jpeg", signatureMode: true },
    expectedWidth: 170, expectedMinHeight: 76, expectedMinKB: 1, expectedMaxKB: 50,
  },
  {
    name: "UPSC Signature",
    inputFile: SIG_FILE,
    outputFile: "upsc_signature.jpg",
    options: { targetWidth: 350, targetHeight: 150, minKB: 1, maxKB: 300, bgColor: null, format: "jpeg", signatureMode: true },
    expectedWidth: 350, expectedMinHeight: 150, expectedMinKB: 1, expectedMaxKB: 300,
  },
  {
    name: "RRB Railway Photo",
    inputFile: PHOTO_FILE,
    outputFile: "rrb_photo.jpg",
    options: { targetWidth: 350, targetHeight: 350, minKB: 20, maxKB: 50, bgColor: "#FFFFFF", format: "jpeg" },
    expectedWidth: 350, expectedMinHeight: 350, expectedMinKB: 20, expectedMaxKB: 50,
  },
  {
    name: "NEET Photo",
    inputFile: PHOTO_FILE,
    outputFile: "neet_photo.jpg",
    options: { targetWidth: 276, targetHeight: 354, minKB: 10, maxKB: 200, bgColor: "#FFFFFF", format: "jpeg" },
    expectedWidth: 276, expectedMinHeight: 354, expectedMinKB: 10, expectedMaxKB: 200,
  },
  {
    name: "Aadhaar Photo",
    inputFile: PHOTO_FILE,
    outputFile: "aadhaar_photo.jpg",
    options: { targetWidth: 150, targetHeight: 200, minKB: 10, maxKB: 100, bgColor: "#FFFFFF", format: "jpeg" },
    expectedWidth: 150, expectedMinHeight: 200, expectedMinKB: 10, expectedMaxKB: 100,
  },
  {
    name: "India Post GDS Photo",
    inputFile: PHOTO_FILE,
    outputFile: "gds_photo.jpg",
    options: { targetWidth: 200, targetHeight: 250, minKB: 20, maxKB: 50, bgColor: "#FFFFFF", format: "jpeg" },
    expectedWidth: 200, expectedMinHeight: 250, expectedMinKB: 20, expectedMaxKB: 50,
  },
  {
    name: "India Post GDS Signature",
    inputFile: SIG_FILE,
    outputFile: "gds_signature.jpg",
    options: { targetWidth: 300, targetHeight: 120, minKB: 1, maxKB: 30, bgColor: null, format: "jpeg", signatureMode: true },
    expectedWidth: 300, expectedMinHeight: 120, expectedMinKB: 1, expectedMaxKB: 30,
  },
];

// ============= Run Validation =============

async function runValidation() {
  console.log("===============================================================");
  console.log("  ADGEN PHOTO RESIZER — VALIDATION REPORT (v3)");
  console.log("  Generated: " + new Date().toISOString());
  console.log("  Photos: top-biased crop (keeps head) | Sigs: center crop");
  console.log("  Date stamp: auto-fit text | Sharpen: adaptive sigma");
  console.log("===============================================================\n");

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let passed = 0;
  let failed = 0;
  const results: string[] = [];

  for (const tc of testCases) {
    try {
      const result = await processImageSharp(tc.inputFile, tc.options);

      const outputPath = path.join(OUTPUT_DIR, tc.outputFile);
      fs.writeFileSync(outputPath, result.buffer);

      const meta = await sharp(result.buffer).metadata();
      const actualW = meta.width!;
      const actualH = meta.height!;

      const checks = [
        { name: "Width", ok: actualW === tc.expectedWidth, val: `${actualW}px`, exp: `${tc.expectedWidth}px` },
        { name: "Height", ok: actualH >= tc.expectedMinHeight, val: `${actualH}px`, exp: `>=${tc.expectedMinHeight}px` },
        { name: "Size >= min", ok: result.sizeKB >= tc.expectedMinKB, val: `${result.sizeKB}KB`, exp: `>=${tc.expectedMinKB}KB` },
        { name: "Size <= max", ok: result.sizeKB <= tc.expectedMaxKB, val: `${result.sizeKB}KB`, exp: `<=${tc.expectedMaxKB}KB` },
      ];

      if (tc.options.signatureMode) {
        const { data } = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
        const r = data[0], g = data[1], b = data[2];
        checks.push({
          name: "White BG",
          ok: r > 200 && g > 200 && b > 200,
          val: `RGB(${r},${g},${b})`,
          exp: "RGB > 200",
        });
      }

      const allPassed = checks.every((c) => c.ok);
      if (allPassed) passed++; else failed++;

      const icon = allPassed ? "✅" : "❌";
      const status = allPassed ? "PASS" : "FAIL";
      const line = `${icon} ${status}  ${tc.name}`;
      console.log(line);
      results.push(line);

      for (const c of checks) {
        const ci = c.ok ? "  ✓" : "  ✗";
        const detail = `${ci} ${c.name}: ${c.val} (expected: ${c.exp})`;
        console.log(detail);
        results.push(detail);
      }

      console.log(`     → Quality: ${result.quality}% | Size: ${result.sizeKB}KB | Output: ${tc.outputFile}`);
      results.push(`     → Quality: ${result.quality}% | Size: ${result.sizeKB}KB | Output: ${tc.outputFile}`);
      console.log("");
      results.push("");
    } catch (err: any) {
      failed++;
      const line = `❌ FAIL  ${tc.name}: ${err.message}`;
      console.log(line);
      results.push(line);
      console.log("");
      results.push("");
    }
  }

  const summary = [
    "===============================================================",
    `  SUMMARY: ${passed}/${testCases.length} PASSED, ${failed} FAILED`,
    `  Output files saved to: test-output/`,
    "===============================================================",
  ];

  summary.forEach((l) => {
    console.log(l);
    results.push(l);
  });

  const reportPath = path.join(OUTPUT_DIR, "VALIDATION_REPORT.txt");
  fs.writeFileSync(reportPath, results.join("\n"));
  console.log(`\nReport saved to: ${reportPath}`);

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "validation_summary.json"),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      total: testCases.length, passed, failed,
      engine: "sharp v3 — top-biased crop, auto-fit stamp",
      outputDir: OUTPUT_DIR,
    }, null, 2)
  );

  if (failed > 0) process.exit(1);
}

runValidation().catch((err) => {
  console.error("Validation script failed:", err);
  process.exit(1);
});
