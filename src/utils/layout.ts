/** Minimum left-side ratio in split mode. */
export const MIN_SPLIT_RATIO = 0.5;

/** Maximum left-side ratio in split mode. */
export const MAX_SPLIT_RATIO = 0.8;

/** Maximum pixel width of the right pane (split & viewer). */
export const MAX_RIGHT_WIDTH = 900;

/**
 * Clamp a left/right split ratio so the right pane never exceeds maxRightWidth.
 */
export function clampSplitRatio(
  ratio: number,
  containerWidth: number,
  maxRightWidth = MAX_RIGHT_WIDTH,
): number {
  const effectiveMin = Math.max(
    MIN_SPLIT_RATIO,
    1 - maxRightWidth / containerWidth,
  );
  return Math.max(effectiveMin, Math.min(MAX_SPLIT_RATIO, ratio));
}
