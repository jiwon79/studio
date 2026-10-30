import { test, expect } from 'vitest';
import { projectReference, referencePose } from './gait-reference';
import { fitPosePhoto, alignedPose, footRms, footMotionRms, faceMotionError, torsoLeanError } from './pose-test-metrics';
import { transformPhotoPoint } from './photo-registration';
test('the same whole-photo fit removes camera offsets without changing anatomical IDs', () => {
  const target = projectReference(referencePose(.13, 0));
  const source = target.map(p => transformPhotoPoint(p, { scale: .94, rotation: .02, dx: 13, dy: -9 }));
  expect(footRms(source, target)).toBeGreaterThan(5);
  expect(footRms(alignedPose(source, fitPosePhoto(source, target)), target)).toBeLessThan(1e-8);
});
test('an exchanged foot stays an error instead of becoming another valid match', () => {
  const target = projectReference(referencePose(.23, 0)), source = target.map(p => [...p]);
  for (const [a, b] of [[27, 28], [29, 30], [31, 32]]) [source[a], source[b]] = [source[b], source[a]];
  expect(footRms(alignedPose(source, fitPosePhoto(source, target)), target)).toBeGreaterThan(10);
});
test('a sudden foot change is measured even if both stills separately look close', () => {
  const a = projectReference(referencePose(.1)), b = projectReference(referencePose(.13)), wrong = b.map(p => [...p]);
  wrong[27][0] += 20 / 512;
  expect(footMotionRms(a, b, a, b)).toBe(0);
  expect(footMotionRms(a, wrong, a, b)).toBeGreaterThan(8);
});

test('face motion compares displacement without treating the rig Head pivot as eyes', () => {
  const target = projectReference(referencePose(.1));
  const source = target.map(p => [...p]);
  source[2][1] -= 55 / 768; source[5][1] -= 55 / 768;
  expect(faceMotionError(source, source, target, target)).toBe(0);
  const moved = source.map(p => [...p]);
  moved[2][0] += 17 / 512; moved[5][0] += 17 / 512;
  expect(faceMotionError(source, moved, target, target)).toBeCloseTo(17, 10);
});
test('torso lean distinguishes a whole-photo roll from position or scale', () => {
  const target = projectReference(referencePose(.2));
  const shifted = target.map(p => transformPhotoPoint(p, { scale: 1.05, rotation: 0, dx: 20, dy: -8 }));
  expect(torsoLeanError(shifted, target)).toBeCloseTo(0, 10);
  const rolled = target.map(p => transformPhotoPoint(p, { scale: 1, rotation: Math.PI / 60, dx: 0, dy: 0 }));
  expect(Math.abs(torsoLeanError(rolled, target))).toBeCloseTo(3, 10);
});
