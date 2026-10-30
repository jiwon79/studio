import type { PosePoints } from './pose-test-metrics';

/** Dimensionless 2D shape diagnostics, invariant to whole-photo similarity.
 * These do not recover depth, identify a visible shoe surface or establish an
 * anatomical knee hidden by fabric. Confidence is exposed, never a pass flag. */
export function lowerBodyShape(points: PosePoints, side: 'left' | 'right') {
  const [hip, knee, ankle, heel, toe] = side === 'right' ? [24, 26, 28, 30, 32] : [23, 25, 27, 29, 31];
  const distance = (a: number, b: number) => Math.hypot((points[a][0] - points[b][0]) * 512, (points[a][1] - points[b][1]) * 768);
  const thigh = distance(hip, knee), calf = distance(knee, ankle);
  return { calfToThigh: thigh > 1 ? calf / thigh : undefined, footToCalf: calf > 1 ? distance(heel, toe) / calf : undefined,
    confidence: Math.min(...[hip, knee, ankle, heel, toe].map(j => points[j][2] ?? 1)) };
}
