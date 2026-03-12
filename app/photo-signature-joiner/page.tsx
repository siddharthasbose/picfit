"use client";

import { useState, useCallback } from "react";
import ImageUploader from "@/components/ImageUploader";
import AdSlot from "@/components/AdSlot";
import { processImage, type ProcessResult } from "@/lib/imageEngine";

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

export default function PhotoSignatureJoinerPage() {
  const [selectedLayout, setSelectedLayout] = useState(LAYOUTS[0]);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [signature, setSignature] = useState<HTMLImageElement | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [resultKB, setResultKB] = useState(0);

  const handleJoin = async () => {
    if (!photo || !signature) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    if (selectedLayout.layout === "vertical") {
      canvas.width = selectedLayout.photoW;
      canvas.height = selectedLayout.photoH + selectedLayout.sigH + 4;
    } else {
      canvas.width = selectedLayout.photoW + selectedLayout.sigW + 4;
      canvas.height = Math.max(selectedLayout.photoH, selectedLayout.sigH);
    }

    // White background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw photo (center-crop)
    const pAspect = selectedLayout.photoW / selectedLayout.photoH;
    const pSrcAspect = photo.naturalWidth / photo.naturalHeight;
    let pCropX = 0, pCropY = 0, pCropW = photo.naturalWidth, pCropH = photo.naturalHeight;
    if (pSrcAspect > pAspect) {
      pCropW = Math.round(photo.naturalHeight * pAspect);
      pCropX = Math.round((photo.naturalWidth - pCropW) / 2);
    } else {
      pCropH = Math.round(photo.naturalWidth / pAspect);
      pCropY = Math.round((photo.naturalHeight - pCropH) / 2);
    }
    ctx.drawImage(photo, pCropX, pCropY, pCropW, pCropH, 0, 0, selectedLayout.photoW, selectedLayout.photoH);

    // Draw signature
    const sigX = selectedLayout.layout === "vertical" ? 0 : selectedLayout.photoW + 4;
    const sigY = selectedLayout.layout === "vertical" ? selectedLayout.photoH + 4 : 0;
    ctx.drawImage(signature, sigX, sigY, selectedLayout.sigW, selectedLayout.sigH);

    // Compress
    let quality = 0.8;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    let sizeKB = Math.round(((dataUrl.length - 23) * 3) / 4 / 1024);
    let lo = 0.1, hi = 0.95;
    for (let i = 0; i < 15 && sizeKB > selectedLayout.maxKB; i++) {
      quality = (lo + hi) / 2;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
      sizeKB = Math.round(((dataUrl.length - 23) * 3) / 4 / 1024);
      if (sizeKB > selectedLayout.maxKB) hi = quality;
      else lo = quality;
    }

    setResult(dataUrl);
    setResultKB(sizeKB);
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
        Combine photo and signature into a single image for exam uploads.
      </p>

      <AdSlot slot="joiner-top" format="horizontal" />

      {/* Layout selector */}
      <div className="space-y-2">
        <p className="text-neutral-400 text-sm font-medium">Select Layout</p>
        <div className="flex gap-2">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedLayout(l)}
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
          onImageLoad={(img) => { setPhoto(img); setResult(null); }}
          label="Upload Photo"
        />
      </div>

      {/* Upload signature */}
      <div>
        <p className="text-neutral-400 text-sm mb-2">2. Upload Signature</p>
        <ImageUploader
          onImageLoad={(img) => { setSignature(img); setResult(null); }}
          label="Upload Signature"
        />
      </div>

      {/* Join button */}
      {photo && signature && !result && (
        <button
          onClick={handleJoin}
          className="w-full py-3 rounded-xl bg-yellow-400 text-neutral-900 font-bold hover:bg-yellow-300 transition-colors"
        >
          Join Photo + Signature
        </button>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div className="bg-emerald-400/10 text-emerald-400 p-3 rounded-xl text-center font-medium border border-emerald-400/30">
            Combined image ready!
          </div>
          <img src={result} alt="Combined" className="mx-auto rounded-lg border border-neutral-700" />
          <p className="text-neutral-400 text-sm text-center">Size: {resultKB}KB</p>
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
