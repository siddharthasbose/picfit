"use client";

import { type ProcessResult } from "@/lib/imageEngine";
import { type ExamPreset } from "@/lib/presets";
import { validateOutput, type ValidationResult } from "@/lib/validators";

interface Props {
  result: ProcessResult;
  preset: ExamPreset;
  originalSize: number;
}

export default function ResultPreview({ result, preset, originalSize }: Props) {
  const validation = validateOutput(result, preset);
  const downloadName = `${preset.id.replace(/-/g, "_")}_${preset.type}.jpg`;

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = result.dataUrl;
    a.download = downloadName;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div
        className={`p-3 rounded-xl text-center font-medium ${
          validation.passed
            ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/30"
            : "bg-amber-400/10 text-amber-400 border border-amber-400/30"
        }`}
      >
        {validation.passed ? "Ready to upload!" : "Some checks need attention"}
      </div>

      {/* Preview */}
      <div className="flex gap-4 items-start">
        <div className="flex-1 text-center">
          <p className="text-neutral-500 text-xs mb-2">Result</p>
          <img
            src={result.dataUrl}
            alt="Result"
            className="mx-auto rounded-lg border border-neutral-700 max-w-full"
            style={{ maxHeight: 200 }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Size" value={`${result.sizeKB}KB`} target={`${preset.minKB}-${preset.maxKB}KB`} pass={result.sizeKB >= preset.minKB && result.sizeKB <= preset.maxKB} />
        <Stat label="Dimensions" value={`${result.width}×${result.height}px`} target={`${preset.width}×${preset.height}px`} pass={result.width === preset.width && result.height >= preset.height} />
        <Stat label="Quality" value={`${result.quality}%`} target="Max possible" pass={result.quality >= 80} />
        <Stat label="Compression" value={`${Math.round((1 - result.sizeKB / (originalSize / 1024)) * 100)}%`} target={`${Math.round(originalSize / 1024)}KB → ${result.sizeKB}KB`} pass={true} />
      </div>

      {/* Validation checklist */}
      <div className="bg-neutral-900 rounded-xl p-4 space-y-2">
        <p className="text-neutral-400 text-sm font-medium">Validation</p>
        {validation.checks.map((check, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span>{check.passed ? "✅" : "❌"}</span>
            <span className="text-neutral-300">{check.name}</span>
            <span className="text-neutral-500 text-xs ml-auto">
              {check.actual}
            </span>
          </div>
        ))}
      </div>

      {/* Download */}
      <button
        onClick={handleDownload}
        data-testid="download-btn"
        className="w-full py-3 rounded-xl bg-yellow-400 text-neutral-900 font-bold text-center hover:bg-yellow-300 transition-colors"
      >
        Download {result.sizeKB}KB JPEG
      </button>

      {/* File name */}
      <p className="text-neutral-600 text-xs text-center">
        Saves as: {downloadName}
      </p>
    </div>
  );
}

function Stat({ label, value, target, pass }: { label: string; value: string; target: string; pass: boolean }) {
  return (
    <div className="bg-neutral-900 rounded-lg p-3">
      <p className="text-neutral-500 text-xs">{label}</p>
      <p className={`font-bold text-lg ${pass ? "text-neutral-200" : "text-amber-400"}`} data-testid={`result-${label.toLowerCase()}`}>
        {value}
      </p>
      {target && <p className="text-neutral-600 text-xs">Target: {target}</p>}
    </div>
  );
}
