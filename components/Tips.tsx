"use client";

import { useState } from "react";
import { type ExamPreset } from "@/lib/presets";

interface Props {
  preset: ExamPreset;
}

const TIPS: Record<string, string[]> = {
  SSC: [
    "Use a recent passport-style photo with white background",
    "Name and date stamp is mandatory - enable it in the tool",
    "Photo must be taken within the last 3 months",
    "Signature should be in black ink on white paper",
    "Do not use digital/computer-generated signatures",
  ],
  UPSC: [
    "Photo should be in color with white background",
    "Face should occupy 70-80% of the frame",
    "No sunglasses, caps, or face coverings",
    "Signature should be clear and consistent with your ID",
  ],
  Banking: [
    "IBPS/SBI require photo, signature, AND left thumb impression",
    "Photo must have white background",
    "Signature in black ink only",
    "Thumb impression should be clear with visible ridges",
  ],
  Railway: [
    "RRB requires square photos (3.5cm x 3.5cm)",
    "White background mandatory",
    "Recent photo within 3 months",
  ],
  default: [
    "Use a well-lit, clear photo",
    "Ensure white/light background",
    "Sign with black ink on white paper for signatures",
    "Check the official notification for exact requirements",
  ],
};

export default function Tips({ preset }: Props) {
  const [open, setOpen] = useState(false);
  const tips = TIPS[preset.category] || TIPS.default;

  return (
    <div className="bg-neutral-900 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm"
      >
        <span className="text-neutral-300 font-medium">
          Tips for {preset.exam}
        </span>
        <span className="text-neutral-500">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ul className="px-4 pb-4 space-y-2">
          {tips.map((tip, i) => (
            <li key={i} className="text-neutral-400 text-sm flex gap-2">
              <span className="text-yellow-400">•</span>
              {tip}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
