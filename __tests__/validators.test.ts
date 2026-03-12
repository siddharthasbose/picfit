import { validateOutput } from "@/lib/validators";
import { type ProcessResult } from "@/lib/imageEngine";
import { PRESETS } from "@/lib/presets";

describe("validators", () => {
  const mockResult = (overrides: Partial<ProcessResult> = {}): ProcessResult => ({
    dataUrl: "data:image/jpeg;base64,abc",
    blob: new Blob(["test"]),
    sizeKB: 35,
    width: 100,
    height: 120,
    quality: 80,
    withinRange: true,
    format: "image/jpeg",
    ...overrides,
  });

  test("SSC photo passes with correct dimensions and size", () => {
    const preset = PRESETS.find((p) => p.id === "ssc-cgl-photo")!;
    const result = mockResult({ width: 100, height: 120, sizeKB: 35 });
    const validation = validateOutput(result, preset);
    expect(validation.passed).toBe(true);
    expect(validation.checks.every((c) => c.passed)).toBe(true);
  });

  test("SSC photo fails with wrong width", () => {
    const preset = PRESETS.find((p) => p.id === "ssc-cgl-photo")!;
    const result = mockResult({ width: 200 });
    const validation = validateOutput(result, preset);
    expect(validation.passed).toBe(false);
    const widthCheck = validation.checks.find((c) => c.name === "Width matches");
    expect(widthCheck?.passed).toBe(false);
  });

  test("SSC photo fails if size too large", () => {
    const preset = PRESETS.find((p) => p.id === "ssc-cgl-photo")!;
    const result = mockResult({ sizeKB: 100 });
    const validation = validateOutput(result, preset);
    expect(validation.passed).toBe(false);
  });

  test("SSC photo fails if size too small", () => {
    const preset = PRESETS.find((p) => p.id === "ssc-cgl-photo")!;
    const result = mockResult({ sizeKB: 5 });
    const validation = validateOutput(result, preset);
    expect(validation.passed).toBe(false);
  });

  test("Height check passes if >= target (for date stamps)", () => {
    const preset = PRESETS.find((p) => p.id === "ssc-cgl-photo")!;
    const result = mockResult({ height: 140 }); // Larger due to stamp
    const validation = validateOutput(result, preset);
    const heightCheck = validation.checks.find((c) => c.name === "Height matches");
    expect(heightCheck?.passed).toBe(true);
  });

  test("Format check validates correctly", () => {
    const preset = PRESETS.find((p) => p.id === "ssc-cgl-photo")!;
    const result = mockResult({ format: "image/png" });
    const validation = validateOutput(result, preset);
    const formatCheck = validation.checks.find((c) => c.name === "Format correct");
    expect(formatCheck?.passed).toBe(false);
  });

  test("All checks have name, expected, and actual", () => {
    const preset = PRESETS.find((p) => p.id === "ssc-cgl-photo")!;
    const result = mockResult();
    const validation = validateOutput(result, preset);
    validation.checks.forEach((c) => {
      expect(c.name).toBeTruthy();
      expect(c.expected).toBeTruthy();
      expect(c.actual).toBeTruthy();
    });
  });
});
