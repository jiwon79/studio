export const ANGLE_STEP = 5;

/** Quantize pointer, keyboard and restored values to the same symmetric grid. */
export function snapYaw(value: number, min = -90, max = 90) {
  const bounded = Math.max(min, Math.min(max, value));
  return Math.sign(bounded) * Math.round(Math.abs(bounded) / ANGLE_STEP) * ANGLE_STEP || 0;
}
