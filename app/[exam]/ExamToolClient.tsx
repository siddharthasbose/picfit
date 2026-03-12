"use client";

import { useState, useCallback } from "react";
import { getPresetById, type ExamPreset } from "@/lib/presets";
import ImageUploader from "@/components/ImageUploader";
import ResultPreview from "@/components/ResultPreview";
import DateStamper from "@/components/DateStamper";
import AdSlot from "@/components/AdSlot";
import { processImage, type ProcessResult } from "@/lib/imageEngine";

interface Props {
  presetId: string;
}

export default function ExamToolClient({ presetId }: Props) {
  const preset = getPresetById(presetId)!;
  const isSignature = preset.type === "signature";

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dateStampEnabled, setDateStampEnabled] = useState(preset.requiresDateStamp);
  const [dateStamp, setDateStamp] = useState<{ name: string; date: string } | undefined>();
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleImageLoad = useCallback((img: HTMLImageElement, f: File) => {
    setImage(img);
    setFile(f);
    setResult(null);
  }, []);

  const handleResize = async () => {
    if (!image) return;
    setProcessing(true);
    try {
      const res = await processImage(image, {
        targetWidth: preset.width,
        targetHeight: preset.height,
        minKB: preset.minKB,
        maxKB: preset.maxKB,
        bgColor: preset.bgColor,
        format: preset.format,
        dateStamp: dateStampEnabled ? dateStamp : undefined,
        signatureMode: isSignature,
      });
      setResult(res);
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setResult(null);
    setImage(null);
    setFile(null);
  };

  return (
    <div className="space-y-6">
      <ImageUploader
        onImageLoad={handleImageLoad}
        label={isSignature ? "Upload Signature" : "Upload Photo"}
      />

      {preset.requiresDateStamp && (
        <DateStamper
          enabled={dateStampEnabled}
          onToggle={setDateStampEnabled}
          onStampChange={setDateStamp}
        />
      )}

      <AdSlot slot={`exam-${presetId}-mid`} format="rectangle" className="my-4" />

      {image && !result && (
        <div className="space-y-3">
          <div className="bg-neutral-900 rounded-xl p-4 text-sm text-neutral-400">
            Target: <span className="text-neutral-200">{preset.width}x{preset.height}px</span> |{" "}
            <span className="text-neutral-200">{preset.minKB}-{preset.maxKB}KB</span> |{" "}
            <span className="text-neutral-200">{preset.format.toUpperCase()}</span>
          </div>
          <button
            onClick={handleResize}
            disabled={processing}
            className="w-full py-3 rounded-xl bg-yellow-400 text-neutral-900 font-bold hover:bg-yellow-300 transition-colors disabled:opacity-50"
          >
            {processing ? "Processing..." : "Resize & Compress Now"}
          </button>
        </div>
      )}

      {result && file && (
        <>
          <ResultPreview result={result} preset={preset} originalSize={file.size} />
          <button
            onClick={reset}
            className="w-full py-2 rounded-xl border border-neutral-700 text-neutral-400 text-sm hover:border-neutral-500"
          >
            Try Another
          </button>
        </>
      )}
    </div>
  );
}
