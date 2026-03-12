import { type ExamPreset } from "@/lib/presets";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

interface Props {
  preset: ExamPreset;
}

export function generatePresetMetadata(preset: ExamPreset) {
  const typeLabel = preset.type === "photo" ? "Photo" : "Signature";
  const title = `${preset.exam} ${typeLabel} Resizer - Resize to ${preset.maxKB}KB Free Online | ${SITE_NAME}`;
  const description = `Free ${preset.exam} ${typeLabel.toLowerCase()} resizer. Resize to ${preset.width}x${preset.height}px, ${preset.minKB}-${preset.maxKB}KB. ${preset.bgColor ? "White background." : ""} Works on mobile. No signup.`;

  return {
    title,
    description,
    keywords: preset.searchKeywords.join(", "),
    openGraph: {
      title,
      description,
      type: "website" as const,
      siteName: SITE_NAME,
    },
  };
}

export function generateJsonLd(preset: ExamPreset) {
  const typeLabel = preset.type === "photo" ? "Photo" : "Signature";
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${preset.exam} ${typeLabel} Resizer`,
    description: `Free online tool to resize ${typeLabel.toLowerCase()}s for ${preset.exam}. Auto-compress to ${preset.minKB}-${preset.maxKB}KB, ${preset.width}x${preset.height}px.`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0" },
    browserRequirements: "Any modern browser",
  };
}

export function generateFaqJsonLd(preset: ExamPreset) {
  const typeLabel = preset.type === "photo" ? "photo" : "signature";
  const faqs = [
    {
      question: `What is the ${preset.exam} ${typeLabel} size requirement?`,
      answer: `${preset.exam} requires ${typeLabel}s to be ${preset.width}x${preset.height} pixels, between ${preset.minKB}-${preset.maxKB}KB in ${preset.format.toUpperCase()} format.${preset.bgColor ? " White background is required." : ""}`,
    },
    {
      question: `How do I resize my ${typeLabel} for ${preset.exam}?`,
      answer: `Upload your ${typeLabel} to our free tool. It will automatically resize to ${preset.width}x${preset.height}px and compress to ${preset.minKB}-${preset.maxKB}KB. Download and upload directly to the ${preset.exam} form.`,
    },
    {
      question: `Is this tool free?`,
      answer: `Yes, completely free. No signup, no watermark, no limits. Your images are processed in your browser and never uploaded to any server.`,
    },
    {
      question: `Does it work on mobile?`,
      answer: `Yes, the tool works on all devices including Android and iPhone. You can even take a photo directly from your camera.`,
    },
    {
      question: `Is my photo safe?`,
      answer: `Absolutely. All processing happens locally in your browser. We never see, store, or upload your photos. Your privacy is guaranteed.`,
    },
  ];

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };
}
