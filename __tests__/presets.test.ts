import { PRESETS } from "@/lib/presets";

describe("presets", () => {
  test("All presets have valid dimensions", () => {
    PRESETS.forEach((p) => {
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
      expect(p.maxKB).toBeGreaterThan(p.minKB);
    });
  });

  test("All presets have unique IDs", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("All non-custom presets have searchKeywords", () => {
    PRESETS.filter((p) => p.id !== "custom").forEach((p) => {
      expect(p.searchKeywords.length).toBeGreaterThan(0);
    });
  });

  test("All photo presets require white background", () => {
    PRESETS.filter((p) => p.type === "photo" && p.id !== "custom").forEach((p) => {
      expect(p.bgColor).toBe("#FFFFFF");
    });
  });

  test("All signature presets have maxKB <= 300", () => {
    PRESETS.filter((p) => p.type === "signature").forEach((p) => {
      expect(p.maxKB).toBeLessThanOrEqual(300);
    });
  });

  test("SSC photo has requiresDateStamp=true", () => {
    const sscPhoto = PRESETS.find((p) => p.id === "ssc-cgl-photo");
    expect(sscPhoto?.requiresDateStamp).toBe(true);
  });

  test("RRB photo has requiresDateStamp=true", () => {
    const rrbPhoto = PRESETS.find((p) => p.id === "rrb-photo");
    expect(rrbPhoto?.requiresDateStamp).toBe(true);
  });

  test("Preset count is 22", () => {
    expect(PRESETS.length).toBe(22);
  });

  test("All presets have a category", () => {
    PRESETS.forEach((p) => {
      expect(p.category).toBeTruthy();
    });
  });

  test("All presets have a format of jpeg or png", () => {
    PRESETS.forEach((p) => {
      expect(["jpeg", "png"]).toContain(p.format);
    });
  });
});
