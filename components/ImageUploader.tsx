"use client";

import { useCallback, useRef, useState } from "react";
import { MAX_FILE_SIZE, ACCEPTED_EXTENSIONS } from "@/lib/constants";

interface Props {
  onImageLoad: (img: HTMLImageElement, file: File) => void;
  label?: string;
}

export default function ImageUploader({ onImageLoad, label = "Upload Photo" }: Props) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);

      if (file.size > MAX_FILE_SIZE) {
        setError("File too large. Maximum 10MB allowed.");
        return;
      }

      if (file.type === "image/heic") {
        setError("HEIC format not yet supported. Please convert to JPEG first.");
        return;
      }

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setPreview(url);
        setFileName(file.name);
        onImageLoad(img, file);
      };
      img.onerror = () => {
        setError("Could not load image. Please try a different file.");
        URL.revokeObjectURL(url);
      };
      img.src = url;
    },
    [onImageLoad]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setPreview(null);
    setFileName(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      {!preview ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-yellow-400 bg-yellow-400/10"
              : "border-neutral-700 hover:border-neutral-500"
          }`}
        >
          <div className="text-4xl mb-2">📷</div>
          <p className="text-neutral-200 font-medium">{label}</p>
          <p className="text-neutral-500 text-sm mt-1">
            Drag & drop or tap to browse
          </p>
          <p className="text-neutral-600 text-xs mt-2">
            JPG, PNG, WebP up to 10MB
          </p>
        </div>
      ) : (
        <div className="bg-neutral-900 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <img
              src={preview}
              alt="Preview"
              className="w-16 h-16 object-cover rounded-lg"
            />
            <div className="flex-1 min-w-0">
              <p className="text-neutral-200 text-sm truncate">{fileName}</p>
              <button
                onClick={reset}
                className="text-rose-400 text-xs hover:underline mt-1"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleChange}
        className="hidden"
      />

      {error && (
        <p className="text-rose-400 text-sm">{error}</p>
      )}
    </div>
  );
}
