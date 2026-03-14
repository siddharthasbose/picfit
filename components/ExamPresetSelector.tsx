"use client";

import { useState } from "react";
import { PRESETS, CATEGORIES, type ExamPreset } from "@/lib/presets";

interface Props {
  type: "photo" | "signature" | "all";
  selectedPreset: ExamPreset | null;
  onSelect: (preset: ExamPreset) => void;
  onCategoryChange?: (category: string | null) => void;
}

export default function ExamPresetSelector({
  type,
  selectedPreset,
  onSelect,
  onCategoryChange,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredPresets = PRESETS.filter((p) => {
    if (type === "all") return true;
    if (type === "photo") return p.type === "photo" || p.type === "thumb";
    return p.type === "signature";
  });

  const categories = [...new Set(filteredPresets.map((p) => p.category))];

  return (
    <div className="space-y-4">
      <p className="text-neutral-400 text-sm font-medium">Select Exam</p>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              const nextCategory = activeCategory === cat ? null : cat;
              setActiveCategory(nextCategory);
              onCategoryChange?.(nextCategory);
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat
                ? "bg-yellow-400 text-neutral-900"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Preset cards */}
      {activeCategory && (
        <div className="grid gap-2">
          {filteredPresets
            .filter((p) => p.category === activeCategory)
            .map((preset) => (
              <button
                key={preset.id}
                onClick={() => onSelect(preset)}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  selectedPreset?.id === preset.id
                    ? "border-yellow-400 bg-yellow-400/10"
                    : "border-neutral-800 bg-neutral-900 hover:border-neutral-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-neutral-200 font-medium text-sm">
                    {preset.name}
                  </span>
                  <span className="text-neutral-500 text-xs">
                    {preset.width}x{preset.height}
                  </span>
                </div>
                <p className="text-neutral-500 text-xs mt-1">{preset.note}</p>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
