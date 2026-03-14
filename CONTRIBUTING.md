# Contributing to PicFit

## Quick Start

```bash
git clone https://github.com/siddharthasbose/picfit.git
cd picfit
npm install
npm run dev        # localhost:3000
npm test           # 28 tests
npm run test:validate  # generate test-output/ images
```

Requires Node 20+ (see `.nvmrc`).

## Architecture: Two Parallel Engines

The image processing logic exists in **two places** that must stay in sync:

| File | Runtime | Library | Purpose |
|------|---------|---------|---------|
| `lib/imageEngine.ts` | Browser | **Pica** (Lanczos3) | Actual user-facing processing |
| `scripts/validate.ts` | Node.js | **sharp** (libvips) | Generates test output images |
| `__tests__/imageEngine.test.ts` | Node.js | **sharp** | Automated spec tests |

**When you change the processing algorithm in one, update all three.**

The browser engine (Pica) is what users actually get. The sharp scripts exist so you can quickly iterate on image quality without opening a browser — `npm run test:validate` generates JPEGs to `test-output/` that you can inspect.

## Image Processing Pipeline

### Photos

```
Source Image
  → Top-biased COVER crop (keeps head, crops bottom)
  → Flatten PNG transparency to white
  → Multi-pass Pica resize (2-pass if >4x downscale)
  → Adaptive unsharp mask (stronger for bigger downscales)
  → Optional date stamp strip (12% of target height)
  → Binary search JPEG compression (maximize quality ≤ maxKB)
```

**Key parameters to tune (in `imageEngine.ts`):**

- `cropY = (srcH - cropH) * 0.20` — top bias factor (0.0 = pure top, 0.5 = center)
- Unsharp amounts by downscale ratio:
  - ≤1.5x: amount=80, radius=0.4
  - 1.5-3x: amount=160, radius=0.8
  - 3-6x: amount=260, radius=0.9
  - >6x: amount=320, radius=0.8
- Multi-pass threshold: ratio > 4 triggers 2-pass resize

### Signatures

```
Source Image
  → Draw full source (no crop ever)
  → Flatten transparency to white
  → Detect dark background (sample edge pixels)
  → Invert if dark background detected
  → Threshold at 140 (binary black/white)
  → Resize to FIT within target (contain mode, white pad)
  → Binary search JPEG compression
```

**Key parameters to tune:**

- Threshold: `140` (lower = more ink preserved, higher = cleaner but thinner strokes)
- Dark background detection: `darkPixels / totalPixels > 0.5`
- Unsharp for signatures: amount=200, radius=0.8

## Tuning Workflow

1. Edit `lib/imageEngine.ts` (browser) and `scripts/validate.ts` (sharp)
2. Run `npm run test:validate` — check `test-output/` images visually
3. Run `npm test` — ensure dimensions and KB specs still pass
4. Test in browser: `npm run dev` → upload a real photo → check output

### Test Samples

- `public/test-samples/sample-photo.jpg` — 413x531px portrait photo
- `public/test-samples/sample-signature.png` — 1609x496px signature (transparent bg)

You can add your own test images to this folder.

## Adding a New Exam Preset

1. Add entry to `lib/presets.ts` (see existing presets for format)
2. The SEO page at `/[exam-slug]-resizer` generates automatically
3. Add a test case in `__tests__/imageEngine.test.ts`
4. Run `npm test` to verify

## Sharp ↔ Pica Parameter Mapping

The two libraries use different parameter scales:

| Concept | Pica (browser) | Sharp (Node) |
|---------|---------------|--------------|
| Unsharp amount | `unsharpAmount: 160` (0-500) | `sharpen({ m1: 0.8 })` (0-10) |
| Unsharp radius | `unsharpRadius: 0.8` | `sharpen({ sigma: 1.0 })` |
| Crop position | Custom `cropY` calc | `position: "north"` |
| Contain fit | Manual scale + pad | `fit: "contain"` |
| Quality | `pica.toBlob(canvas, mime, 0.95)` (0-1) | `jpeg({ quality: 95 })` (0-100) |

They won't produce identical output, but should be visually close. The browser engine is the source of truth.

## Code Style

- TypeScript strict mode
- No external API calls — everything client-side
- Tailwind for styling (dark theme: neutral-950 bg)
- Keep it simple — no unnecessary abstractions
