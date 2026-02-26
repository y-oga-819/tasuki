import { describe, it, expect } from "vitest";
import {
  clampScale,
  MIN_SCALE,
  MAX_SCALE,
  ZOOM_STEP,
} from "../utils/zoom";

describe("clampScale", () => {
  it("clamps to MIN_SCALE when scale is too small", () => {
    expect(clampScale(-1)).toBe(MIN_SCALE);
    expect(clampScale(0)).toBe(MIN_SCALE);
    expect(clampScale(0.1)).toBe(MIN_SCALE);
  });

  it("clamps to MAX_SCALE when scale is too large", () => {
    expect(clampScale(10)).toBe(MAX_SCALE);
    expect(clampScale(5.5)).toBe(MAX_SCALE);
  });

  it("passes through scale within bounds", () => {
    expect(clampScale(1)).toBe(1);
    expect(clampScale(2.5)).toBe(2.5);
    expect(clampScale(MIN_SCALE)).toBe(MIN_SCALE);
    expect(clampScale(MAX_SCALE)).toBe(MAX_SCALE);
  });

  it("zoom in from 1x stays within bounds", () => {
    const zoomed = clampScale(1 + ZOOM_STEP * 2);
    expect(zoomed).toBeGreaterThan(1);
    expect(zoomed).toBeLessThanOrEqual(MAX_SCALE);
  });

  it("zoom out from 1x stays within bounds", () => {
    const zoomed = clampScale(1 - ZOOM_STEP * 2);
    expect(zoomed).toBeLessThan(1);
    expect(zoomed).toBeGreaterThanOrEqual(MIN_SCALE);
  });

  it("repeated zoom in saturates at MAX_SCALE", () => {
    let scale = 1;
    for (let i = 0; i < 100; i++) {
      scale = clampScale(scale + ZOOM_STEP);
    }
    expect(scale).toBe(MAX_SCALE);
  });

  it("repeated zoom out saturates at MIN_SCALE", () => {
    let scale = 1;
    for (let i = 0; i < 100; i++) {
      scale = clampScale(scale - ZOOM_STEP);
    }
    expect(scale).toBe(MIN_SCALE);
  });
});
