import { transformPhotoPoint, type PhotoTransform } from './photo-registration';
export type PosePoints = readonly (readonly number[])[];
const joints = [11, 12, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
const weights = [.5, .5, .7, .7, .7, .7, 1, 1, .7, .7, .7, .7];
export const feet = [27, 28, 29, 30, 31, 32];
const pixel = (p: readonly number[]) => [p[0] * 512, p[1] * 768];

/** Identical nuisance-camera alignment for every method. Fixed anatomical IDs;
 * no per-limb deformation, reflection, foot exchange or confidence reweighting. */
export function fitPosePhoto(source: PosePoints, target: PosePoints): PhotoTransform {
  const a = joints.map(j => pixel(source[j])), b = joints.map(j => pixel(target[j]));
  const weight = weights.reduce((s, w) => s + w, 0);
  const center = (p: number[][]) => [0, 1].map(k => p.reduce((s, point, i) => s + point[k] * weights[i], 0) / weight);
  const ac = center(a), bc = center(b);
  let dot = 0, cross = 0, denominator = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i][0] - ac[0], y = a[i][1] - ac[1], u = b[i][0] - bc[0], v = b[i][1] - bc[1], w = weights[i];
    dot += w * (x * u + y * v); cross += w * (x * v - y * u); denominator += w * (x * x + y * y);
  }
  if (denominator < 1e-6) throw new Error('Degenerate pose');
  const scale = Math.hypot(dot, cross) / denominator, rotation = Math.atan2(cross, dot), c = Math.cos(rotation), s = Math.sin(rotation);
  const tx = bc[0] - scale * (ac[0] * c - ac[1] * s), ty = bc[1] - scale * (ac[0] * s + ac[1] * c);
  return { scale, rotation, dx: tx - 256 + scale * (256 * c - 420 * s), dy: ty - 420 + scale * (256 * s + 420 * c) };
}
export const alignedPose = (points: PosePoints, transform: PhotoTransform) => points.map(point => transformPhotoPoint(point, transform));
export function footRms(source: PosePoints, target: PosePoints) {
  return Math.sqrt(feet.reduce((sum, j) => sum + ((source[j][0] - target[j][0]) * 512) ** 2 + ((source[j][1] - target[j][1]) * 768) ** 2, 0) / feet.length);
}
export function footMotionRms(before: PosePoints, after: PosePoints, targetBefore: PosePoints, targetAfter: PosePoints) {
  return Math.sqrt(feet.reduce((sum, j) => sum + ((after[j][0] - before[j][0] - targetAfter[j][0] + targetBefore[j][0]) * 512) ** 2 + ((after[j][1] - before[j][1] - targetAfter[j][1] + targetBefore[j][1]) * 768) ** 2, 0) / feet.length);
}
export const footConfidence = (points: PosePoints) => Math.min(...feet.map(j => points[j][2] ?? 1));
