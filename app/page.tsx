import { SITE_NAME } from "@/lib/constants";
import AdSlot from "@/components/AdSlot";

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3 py-6">
        <h1 className="text-3xl font-bold text-neutral-100">
          Free Photo & Signature Resizer
        </h1>
        <p className="text-neutral-400 max-w-md mx-auto">
          Resize photos and signatures for Indian government exams. SSC, UPSC,
          IBPS, Railway, NEET, JEE, PAN, Aadhaar, Passport & more.
        </p>
        <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm">
          <span>🔒</span>
          <span>100% browser-based — we never see your photos</span>
        </div>
      </div>

      <AdSlot slot="top-banner" format="horizontal" />

      {/* Tool cards */}
      <div className="grid gap-4">
        <a
          href="/photo-resizer"
          className="block p-6 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-yellow-400/50 transition-colors"
        >
          <div className="text-2xl mb-2">📷</div>
          <h2 className="text-xl font-bold text-neutral-100">Photo Resizer</h2>
          <p className="text-neutral-400 text-sm mt-1">
            Resize passport photos for any exam. Auto-compress to exact KB and
            pixel requirements.
          </p>
        </a>

        <a
          href="/signature-resizer"
          className="block p-6 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-yellow-400/50 transition-colors"
        >
          <div className="text-2xl mb-2">✍️</div>
          <h2 className="text-xl font-bold text-neutral-100">
            Signature Resizer
          </h2>
          <p className="text-neutral-400 text-sm mt-1">
            Clean up and resize signatures. Handles dark backgrounds, auto-converts to
            black ink on white.
          </p>
        </a>

        <a
          href="/photo-signature-joiner"
          className="block p-6 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-yellow-400/50 transition-colors"
        >
          <div className="text-2xl mb-2">🖼️</div>
          <h2 className="text-xl font-bold text-neutral-100">
            Photo + Signature Joiner
          </h2>
          <p className="text-neutral-400 text-sm mt-1">
            Combine photo and signature into a single image for IBPS/SSC/RRB uploads.
          </p>
        </a>
      </div>

      {/* Supported exams */}
      <div className="text-center space-y-3">
        <h2 className="text-lg font-bold text-neutral-300">
          Supports 22+ Exam Formats
        </h2>
        <div className="flex flex-wrap gap-2 justify-center">
          {[
            "SSC CGL",
            "SSC CHSL",
            "UPSC",
            "IBPS",
            "SBI PO",
            "RRB",
            "NEET",
            "JEE Main",
            "PAN Card",
            "Aadhaar",
            "Passport",
            "India Post GDS",
            "Kerala PSC",
          ].map((exam) => (
            <span
              key={exam}
              className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs"
            >
              {exam}
            </span>
          ))}
        </div>
      </div>

      <AdSlot slot="bottom-rect" format="rectangle" />
    </div>
  );
}
