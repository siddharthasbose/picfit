import { type ProcessResult } from "./imageEngine";
import { type ExamPreset } from "./presets";

export interface ValidationCheck {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
}

export function validateOutput(
  result: ProcessResult,
  preset: ExamPreset
): ValidationResult {
  const checks: ValidationCheck[] = [
    {
      name: "File size within range",
      passed: result.sizeKB >= preset.minKB && result.sizeKB <= preset.maxKB,
      expected: `${preset.minKB}-${preset.maxKB}KB`,
      actual: `${result.sizeKB}KB`,
    },
    {
      name: "Width matches",
      passed: result.width === preset.width,
      expected: `${preset.width}px`,
      actual: `${result.width}px`,
    },
    {
      name: "Height matches",
      passed: result.height >= preset.height,
      expected: `>=${preset.height}px`,
      actual: `${result.height}px`,
    },
    {
      name: "Format correct",
      passed: result.format === `image/${preset.format}`,
      expected: `image/${preset.format}`,
      actual: result.format,
    },
  ];

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}
