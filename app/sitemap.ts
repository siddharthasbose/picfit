import { MetadataRoute } from "next";
import { PRESETS, getPresetSlug } from "@/lib/presets";
import { SITE_URL } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 1 },
    { url: `${SITE_URL}/photo-resizer`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${SITE_URL}/signature-resizer`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${SITE_URL}/photo-signature-joiner`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.8 },
  ];

  const examRoutes = PRESETS.filter((p) => p.id !== "custom").map((p) => ({
    url: `${SITE_URL}/${getPresetSlug(p)}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...examRoutes];
}
