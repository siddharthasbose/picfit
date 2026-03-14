"use client";

import { useState } from "react";
import ImageUploader from "@/components/ImageUploader";
import AdSlot from "@/components/AdSlot";
import { processImage } from "@/lib/imageEngine";

interface JoinerLayout {
  id: string;
  name: string;
  photoW: number;
  photoH: number;
  sigW: number;
  sigH: number;
  layout: "vertical" | "horizontal";
  maxKB: number;
}

const LAYOUTS: JoinerLayout[] = [
  { id: "ibps", name: "IBPS/SBI", photoW: 200, photoH: 230, sigW: 140, sigH: 60, layout: "vertical", maxKB: 50 },
  { id: "ssc", name: "SSC", photoW: 100, photoH: 120, sigW: 140, sigH: 60, layout: "horizontal", maxKB: 50 },
];

const JOIN_GAP = 4;

function estimateDataUrlKB(dataUrl: string): number {
  const base64Length = dataUrl.split(",")[1]?.length || 0;
  return Math.round((base64Length * 3) / 4 / 1024);
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load processed image"));
    img.src = dataUrl;
  });
}

function compressCanvasToJpeg(canvas: HTMLCanvasElement, maxKB: number) {
  let bestDataUrl = "";
  let bestSizeKB = 0;
  let bestQuality = 0.95;
  let lo = 0.05;
  let hi = 0.99;

  for (let i = 0; i < 25; i++) {
    const mid = (lo + hi) / 2;
    const dataUrl = canvas.toDataURL("image/jpeg", mid);
    const sizeKB = estimateDataUrlKB(dataUrl);

    if (sizeKB <= maxKB) {
      bestDataUrl = dataUrl;
      bestSizeKB = sizeKB;
      bestQuality = mid;
      lo = mid;
    } else {
      hi = mid;
    }

    if (hi - lo < 0.005) break;
  }

  if (!bestDataUrl) {
    bestDataUrl = canvas.toDataURL("image/jpeg", 0.05);
    bestSizeKB = estimateDataUrlKB(bestDataUrl);
    bestQuality = 0.05;
  }

  return {
    dataUrl: bestDataUrl,
    sizeKB: bestSizeKB,
    qualityPercent: Math.round(bestQuality * 100),
  };
}

export default function PhotoSignatureJoinerPage() {
  const [selectedLayout, setSelectedLayout] = useState(LAYOUTS[0]);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [signature, setSignature] = useState<HTMLImageElement | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [resultKB, setResultKB] = useState(0);
  const [resultQuality, setResultQuality] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!photo || !signature) return;
    setProcessing(true);
    setError(null);

    try {
      // Process each image with the same engine used by standalone tools.
      const [photoResult, signatureResult] = await Promise.all([
        processImage(photo, {
          targetWidth: selectedLayout.photoW,
          targetHeight: selectedLayout.photoH,
          minKB: 1,
          maxKB: 500,
          bgColor: "#FFFFFF",
          format: "jpeg",
          signatureMode: false,
        }),
        processImage(signature, {
          targetWidth: selectedLayout.sigW,
          targetHeight: selectedLayout.sigH,
          minKB: 1,
          maxKB: 300,
          bgColor: null,
          format: "jpeg",
          signatureMode: true,
        }),
      ]);

      const [photoImg, sigImg] = await Promise.all([
        loadImageFromDataUrl(photoResult.dataUrl),
        loadImageFromDataUrl(signatureResult.dataUrl),
      ]);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create canvas context");

      if (selectedLayout.layout === "vertical") {
        canvas.width = Math.max(selectedLayout.photoW, selectedLayout.sigW);
        canvas.height = selectedLayout.photoH + selectedLayout.sigH + JOIN_GAP;
      } else {
        canvas.width = selectedLayout.photoW + selectedLayout.sigW + JOIN_GAP;
        canvas.height = Math.max(selectedLayout.photoH, selectedLayout.sigH);
      }

      // White background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw photo + signature with centering inside each region
      if (selectedLayout.layout === "vertical") {
        const photoX = Math.round((canvas.width - selectedLayout.photoW) / 2);
        const sigX = Math.round((canvas.width - selectedLayout.sigW) / 2);
        const sigY = selectedLayout.photoH + JOIN_GAP;

        ctx.drawImage(photoImg, photoX, 0, selectedLayout.photoW, selectedLayout.photoH);
        ctx.drawImage(sigImg, sigX, sigY, selectedLayout.sigW, selectedLayout.sigH);
      } else {
        const photoY = Math.round((canvas.height - selectedLayout.photoH) / 2);
        const sigY = Math.round((canvas.height - selectedLayout.sigH) / 2);
        const sigX = selectedLayout.photoW + JOIN_GAP;

        ctx.drawImage(photoImg, 0, photoY, selectedLayout.photoW, selectedLayout.photoH);
        ctx.drawImage(sigImg, sigX, sigY, selectedLayout.sigW, selectedLayout.sigH);
      }

      const compressed = compressCanvasToJpeg(canvas, selectedLayout.maxKB);
      setResult(compressed.dataUrl);
      setResultKB(compressed.sizeKB);
      setResultQuality(compressed.qualityPercent);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not combine the images. Please try again."
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = `${selectedLayout.id}_photo_signature.jpg`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Photo + Signature Joiner</h1>
      <p className="text-neutral-400 text-sm">
        Combine a resized photo and cleaned signature into one JPEG.
      </p>
      <div className="bg-amber-400/10 text-amber-300 border border-amber-500/30 rounded-xl p-3 text-xs">
        Note: many portals (including IBPS) require separate uploads for photo/signature.
        Use this only when a combined file is explicitly requested.
      </div>

      <AdSlot slot="joiner-top" format="horizontal" />

      {/* Layout selector */}
      <div className="space-y-2">
        <p className="text-neutral-400 text-sm font-medium">Select Layout</p>
        <div className="flex gap-2">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setSelectedLayout(l);
                setResult(null);
                setError(null);
              }}
              className={`px-4 py-2 rounded-xl text-sm ${
                selectedLayout.id === l.id
                  ? "bg-yellow-400 text-neutral-900 font-medium"
                  : "bg-neutral-800 text-neutral-300"
              }`}
            >
              {l.name} ({l.layout})
            </button>
          ))}
        </div>
      </div>

      {/* Upload photo */}
      <div>
        <p className="text-neutral-400 text-sm mb-2">1. Upload Photo</p>
        <ImageUploader
          onImageLoad={(img) => {
            setPhoto(img);
            setResult(null);
            setError(null);
          }}
          label="Upload Photo"
        />
      </div>

      {/* Upload signature */}
      <div>
        <p className="text-neutral-400 text-sm mb-2">2. Upload Signature</p>
        <ImageUploader
          onImageLoad={(img) => {
            setSignature(img);
            setResult(null);
            setError(null);
          }}
          label="Upload Signature"
        />
      </div>

      {/* Join button */}
      {photo && signature && !result && (
        <button
          onClick={handleJoin}
          disabled={processing}
          className="w-full py-3 rounded-xl bg-yellow-400 text-neutral-900 font-bold hover:bg-yellow-300 transition-colors disabled:opacity-60"
        >
          {processing ? "Combining..." : "Join Photo + Signature"}
        </button>
      )}

      {error && (
        <p className="text-rose-400 text-sm">{error}</p>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div className="bg-emerald-400/10 text-emerald-400 p-3 rounded-xl text-center font-medium border border-emerald-400/30">
            Combined image ready!
          </div>
          <img src={result} alt="Combined" className="mx-auto rounded-lg border border-neutral-700" />
          <p className="text-neutral-400 text-sm text-center">
            Size: {resultKB}KB | Quality: {resultQuality}%
          </p>
          <button
            onClick={handleDownload}
            className="w-full py-3 rounded-xl bg-yellow-400 text-neutral-900 font-bold hover:bg-yellow-300 transition-colors"
          >
            Download {resultKB}KB JPEG
          </button>
        </div>
      )}

      <AdSlot slot="joiner-bottom" format="rectangle" />
    </div>
  );
}
