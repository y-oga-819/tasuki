/** Minimum zoom scale. */
export const MIN_SCALE = 0.25;

/** Maximum zoom scale. */
export const MAX_SCALE = 5;

/** Zoom increment per mouse wheel tick. */
export const ZOOM_STEP = 0.15;

/** Clamp a zoom scale within the allowed range. */
export function clampScale(scale: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}
