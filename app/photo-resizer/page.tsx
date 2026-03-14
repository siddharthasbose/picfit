"use client";

import { useState, useCallback } from "react";
import ExamPresetSelector from "@/components/ExamPresetSelector";
import ImageUploader from "@/components/ImageUploader";
import ResultPreview from "@/components/ResultPreview";
import DateStamper from "@/components/DateStamper";
import AdSlot from "@/components/AdSlot";
import Tips from "@/components/Tips";
import { type ExamPreset } from "@/lib/presets";
import { processImage, type ProcessResult } from "@/lib/imageEngine";

export default function PhotoResizerPage() {
  const [preset, setPreset] = useState<ExamPreset | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [dateStamperKey, setDateStamperKey] = useState(0);
  const [dateStampEnabled, setDateStampEnabled] = useState(false);
  const [dateStamp, setDateStamp] = useState<
    { name: string; date: string } | undefined
  >();
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleImageLoad = useCallback(
    (img: HTMLImageElement, f: File) => {
      setImage(img);
      setFile(f);
      setResult(null);
    },
    []
  );

  const handleResize = async () => {
    if (!preset || !image) return;
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
        signatureMode: false,
      });
      setResult(res);
    } finally {
      setProcessing(false);
    }
  };

  const clearUploadState = () => {
    setResult(null);
    setImage(null);
    setFile(null);
  };

  const reset = () => {
    clearUploadState();
    setUploaderKey((k) => k + 1);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Photo Resizer</h1>
      <p className="text-neutral-400 text-sm">
        Resize your photo to exact exam specifications. 100% client-side.
      </p>

      <AdSlot slot="photo-top" format="horizontal" />

      {/* Step 1: Select Exam */}
      <ExamPresetSelector
        type="photo"
        selectedPreset={preset}
        onCategoryChange={() => {
          clearUploadState();
          setPreset(null);
          setDateStampEnabled(false);
          setDateStamp(undefined);
          setUploaderKey((k) => k + 1);
          setDateStamperKey((k) => k + 1);
        }}
        onSelect={(p) => {
          clearUploadState();
          setPreset(p);
          setDateStampEnabled(p.requiresDateStamp);
          setDateStamp(undefined);
          setUploaderKey((k) => k + 1);
          setDateStamperKey((k) => k + 1);
        }}
      />

      {/* Step 2: Upload */}
      {preset && (
        <>
          <ImageUploader
            key={`${preset.id}-${uploaderKey}`}
            onImageLoad={handleImageLoad}
            label="Upload Photo"
          />

          {/* Date stamp */}
          {preset.requiresDateStamp && (
            <DateStamper
              key={`${preset.id}-${dateStamperKey}`}
              enabled={dateStampEnabled}
              onToggle={setDateStampEnabled}
              onStampChange={setDateStamp}
            />
          )}
        </>
      )}

      <AdSlot slot="photo-mid" format="rectangle" className="my-4" />

      {/* Step 3: Resize */}
      {preset && image && !result && (
        <div className="space-y-3">
          <div className="bg-neutral-900 rounded-xl p-4 text-sm text-neutral-400">
            <p>
              Target: <span className="text-neutral-200">{preset.width}x{preset.height}px</span> |{" "}
              <span className="text-neutral-200">{preset.minKB}-{preset.maxKB}KB</span> |{" "}
              <span className="text-neutral-200">{preset.format.toUpperCase()}</span>
              {preset.bgColor && (
                <> | <span className="text-neutral-200">White BG</span></>
              )}
            </p>
          </div>

          <button
            onClick={handleResize}
            disabled={processing}
            className="w-full py-3 rounded-xl bg-yellow-400 text-neutral-900 font-bold text-center hover:bg-yellow-300 transition-colors disabled:opacity-50"
          >
            {processing ? "Processing..." : "Resize & Compress Now"}
          </button>
        </div>
      )}

      {/* Step 4: Result */}
      {result && preset && file && (
        <>
          <ResultPreview result={result} preset={preset} originalSize={file.size} />

          <button
            onClick={reset}
            className="w-full py-2 rounded-xl border border-neutral-700 text-neutral-400 text-sm hover:border-neutral-500 transition-colors"
          >
            Try Another Photo
          </button>

          <a
            href="/signature-resizer"
            className="block text-center text-yellow-400 text-sm hover:underline"
          >
            Also need signature? →
          </a>
        </>
      )}

      {preset && <Tips preset={preset} />}

      <AdSlot slot="photo-bottom" format="rectangle" />
    </div>
  );
}
