# FitPic

Resize photos and signatures for Indian government exam form uploads. 100% client-side — your images never leave your browser.

## The Problem

Every Indian government exam (SSC, UPSC, IBPS, NEET, JEE, PAN, Passport, etc.) has different photo and signature requirements — specific pixel dimensions, file size limits in KB, and format rules. Getting these wrong means your application gets rejected.

FitPic handles all of this automatically: pick your exam, upload your photo or signature, and download a correctly sized file that meets all requirements.

## Features

- **22 exam presets** — SSC, UPSC, IBPS/SBI, RRB Railway, NEET, JEE, PAN Card, Aadhaar, Passport, India Post GDS, Kerala PSC, and custom sizes
- **100% client-side** — all processing happens in your browser using [Pica](https://github.com/nodeca/pica) (Lanczos3 resampling). No server uploads, no data collection
- **Smart photo cropping** — top-biased crop keeps your head visible, crops from the bottom
- **Signature processing** — auto-detects dark backgrounds, inverts if needed, thresholds to clean black-on-white. Never crops signatures (uses contain/fit mode)
- **Date stamp** — SSC and RRB exams require "Name | Date" stamped below the photo. Auto-fits text to width
- **Binary search compression** — finds the highest JPEG quality that fits under the KB limit
- **Multi-pass resize** — for extreme downscales (>4x), resizes in two passes for sharper output
- **SEO pages** — each exam has its own URL (`/ssc-cgl-photo-resizer`, `/upsc-photo-resizer`, etc.)

## Supported Exams

| Exam | Photo | Signature | Notes |
|------|-------|-----------|-------|
| SSC CGL/CHSL/MTS | 100x120, 20-50KB | 140x60, 10-20KB | Date stamp required |
| UPSC Civil Services | 350x350, 30-100KB | 350x150, 20-300KB | |
| IBPS/SBI Bank | 200x230, 20-50KB | 140x60, 10-20KB | + Left thumb 240x240 |
| RRB Railway | 350x350, 20-50KB | 350x140, 20-50KB | Date stamp required |
| RRB Group D | 320x240, 20-70KB | 140x60, 30-70KB | |
| NEET UG | 276x354, 10-200KB | — | Postcard ratio |
| JEE Main | 276x354, 10-200KB | — | |
| PAN Card (NSDL) | 132x170, 20-50KB | 170x76, 10-50KB | |
| Aadhaar | 150x200, 10-100KB | — | |
| Indian Passport | 413x531, 20-300KB | — | 300 DPI |
| India Post GDS | 200x250, 20-50KB | 300x120, 10-30KB | |
| Kerala PSC | 200x150, 10-30KB | 100x150, 10-30KB | |

## Getting Started

```bash
# Clone
git clone https://github.com/siddharthasbose/fitpic.git
cd fitpic

# Install dependencies
npm install

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **Pica** — Lanczos3 image resampling (browser-side)
- **Tailwind CSS** — dark theme UI
- **Sharp** — Node.js image processing for tests/validation only

## Project Structure

```
app/
  page.tsx                    # Homepage with exam grid
  photo-resizer/page.tsx      # Generic photo resizer
  signature-resizer/page.tsx  # Generic signature resizer
  photo-signature-joiner/     # Combine photo + signature
  [exam]/page.tsx             # Dynamic per-exam pages (SEO)
  sitemap.ts                  # Auto-generated sitemap
components/
  ImageUploader.tsx           # File upload + preview
  PresetSelector.tsx          # Exam preset picker
  ResultPreview.tsx           # Output preview + download
  DateStamper.tsx             # Name + date stamp input
lib/
  imageEngine.ts              # Core Pica processing engine
  presets.ts                  # 22 exam preset definitions
  constants.ts                # Site config
```

## How the Image Engine Works

### Photos
1. Top-biased COVER crop at source resolution (keeps head, crops bottom)
2. Flatten PNG transparency to white
3. Multi-pass Pica resize (2-pass for >4x downscale)
4. Adaptive unsharp mask based on downscale ratio
5. Optional date stamp strip (12% of target height)
6. Binary search JPEG compression (maximize quality under KB limit)

### Signatures
1. Draw full source (no crop)
2. Flatten transparency to white background
3. Detect dark background by sampling edge pixels
4. Invert if dark, then threshold at 140 (clean black-on-white)
5. Resize to FIT within target (contain mode, white padding)
6. Binary search JPEG compression

## Running Tests

```bash
# Jest tests (28 tests)
npm test

# Validation script — generates output images to test-output/
npm run test:validate
```

Test samples live in `public/test-samples/`.

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit and push
6. Open a pull request

### Adding a New Exam Preset

Edit `lib/presets.ts` and add a new entry to the `PRESETS` array:

```typescript
{
  id: "exam-name-photo",
  name: "Exam Name Photo",
  exam: "Exam Name",
  type: "photo",        // "photo" | "signature" | "thumb"
  width: 200,
  height: 230,
  minKB: 20,
  maxKB: 50,
  bgColor: "#FFFFFF",   // null for signatures
  format: "jpeg",
  dpi: 200,
  requiresDateStamp: false,
  note: "Description of requirements",
  officialUrl: "https://...",
  category: "Category",
  searchKeywords: ["search terms"],
}
```

The SEO page at `/exam-name-photo-resizer` is generated automatically.

## License

MIT
