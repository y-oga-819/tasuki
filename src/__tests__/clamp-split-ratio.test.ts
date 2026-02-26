import { describe, it, expect } from "vitest";
import {
  clampSplitRatio,
  MIN_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
  MAX_RIGHT_WIDTH,
} from "../utils/layout";

describe("clampSplitRatio", () => {
  it("clamps to effective min when ratio is too small", () => {
    // 1920px: effectiveMin = max(0.5, 1 - 900/1920) = max(0.5, 0.53125) = 0.53125
    const effectiveMin = 1 - MAX_RIGHT_WIDTH / 1920;
    expect(clampSplitRatio(0.2, 1920)).toBeCloseTo(effectiveMin, 5);
  });

  it("clamps to MAX_SPLIT_RATIO when ratio is too large", () => {
    expect(clampSplitRatio(0.95, 1920)).toBe(MAX_SPLIT_RATIO);
  });

  it("passes through a ratio within normal bounds", () => {
    expect(clampSplitRatio(0.65, 1920)).toBe(0.65);
  });

  it("on wide screens, raises effective min so right pane stays <= MAX_RIGHT_WIDTH", () => {
    // 3840px wide: effectiveMin = max(0.5, 1 - 900/3840) = max(0.5, 0.765625) = 0.765625
    const result = clampSplitRatio(0.5, 3840);
    const expectedMin = 1 - MAX_RIGHT_WIDTH / 3840;
    expect(result).toBeCloseTo(expectedMin, 5);
    expect(result).toBeGreaterThan(MIN_SPLIT_RATIO);
  });

  it("on normal screens, MIN_SPLIT_RATIO dominates", () => {
    // 1200px wide: effectiveMin = max(0.5, 1 - 900/1200) = max(0.5, 0.25) = 0.5
    expect(clampSplitRatio(0.5, 1200)).toBe(MIN_SPLIT_RATIO);
  });

  it("respects custom maxRightWidth parameter", () => {
    // 2000px wide, max right 400px: effectiveMin = max(0.5, 1 - 400/2000) = max(0.5, 0.8) = 0.8
    const result = clampSplitRatio(0.6, 2000, 400);
    expect(result).toBe(MAX_SPLIT_RATIO);
  });

  it("handles very narrow containers gracefully", () => {
    // 500px wide: effectiveMin = max(0.5, 1 - 900/500) = max(0.5, -0.8) = 0.5
    expect(clampSplitRatio(0.3, 500)).toBe(MIN_SPLIT_RATIO);
  });

  it("ensures right pane never exceeds MAX_RIGHT_WIDTH on ultra-wide screen", () => {
    const containerWidth = 5000;
    const ratio = clampSplitRatio(0.5, containerWidth);
    const rightWidth = containerWidth * (1 - ratio);
    expect(rightWidth).toBeLessThanOrEqual(MAX_RIGHT_WIDTH);
  });
});
