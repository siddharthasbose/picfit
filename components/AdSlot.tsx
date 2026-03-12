"use client";

interface Props {
  slot: string;
  format?: "horizontal" | "rectangle" | "vertical";
  className?: string;
}

const SIZES = {
  horizontal: { minHeight: 50, label: "320x50 Ad" },
  rectangle: { minHeight: 250, label: "300x250 Ad" },
  vertical: { minHeight: 600, label: "300x600 Ad" },
};

export default function AdSlot({ slot, format = "rectangle", className = "" }: Props) {
  const size = SIZES[format];

  return (
    <div
      className={`bg-neutral-900/50 border border-dashed border-neutral-800 rounded-lg flex items-center justify-center text-neutral-700 text-xs ${className}`}
      style={{ minHeight: size.minHeight }}
      data-ad-slot={slot}
      data-ad-format={format}
    >
      {size.label}
    </div>
  );
}
