import type { PhotoTransform } from './photo-registration';

/** Convert an origin-based alpha framing fit to the renderer's (256,420) pivot.
 * This only restores the generated photograph's framing to its source crop.
 * There is no rig, rotation, perspective change or limb deformation. */
export function qualityFraming(fit: { scale: number; dx: number; dy: number }): PhotoTransform {
  return { scale: fit.scale, rotation: 0, dx: fit.dx + (fit.scale - 1) * 256, dy: fit.dy + (fit.scale - 1) * 420 };
}
