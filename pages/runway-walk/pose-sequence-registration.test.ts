import { test, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import data from './assets/pose-test/manifest.json';
import { projectReference, referencePose } from './gait-reference';
import { transformPhotoPoint } from './photo-registration';
import { alignedPose, fitPosePhoto, faceMotionError, torsoLeanError, footMotionRms, footRms } from './pose-test-metrics';
import { fitPoseSequence } from './pose-sequence-registration';

test('joint similarities recover independent camera shifts and preserve every anatomical landmark', () => {
  const target = [.05, .08, .11].map(p => projectReference(referencePose(p)));
  const source = target.map((points, i) => points.map(p => transformPhotoPoint(p, { scale: 1.02, rotation: .02, dx: i * 5, dy: -i * 3 })));
  const fitted = fitPoseSequence(source, target);
  source.forEach((points, i) => {
    const aligned = alignedPose(points, fitted[i]);
    expect(footRms(aligned, target[i])).toBeLessThan(1e-6);
    expect(aligned[2][0]).toBeCloseTo(target[i][2][0], 8);
  });
});

test('a mismatched individual foot is still an error after whole-photo registration', () => {
  const target = [.05, .08, .11].map(p => projectReference(referencePose(p)));
  const source = target.map(points => points.map(p => [...p]));
  source[1][27][0] += 40 / 512;
  const transforms = fitPoseSequence(source, target);
  expect(footRms(alignedPose(source[1], transforms[1]), target[1])).toBeGreaterThan(8);
});

test('all twelve new GPT assets retain provenance and jointly improve displayed face, torso and foot continuity', () => {
  const frames = data.frames;
  const targets = frames.map(row => row.target.map((p, j) => j === 2 ? row.headTarget.leftEye : j === 5 ? row.headTarget.rightEye : p));
  const fit = fitPoseSequence(frames.map(r => r.headBodyPoints), targets);
  const before = frames.map(r => alignedPose(r.modelFirstPoints, fitPosePhoto(r.modelFirstPoints, r.target)));
  const after = frames.map((r, i) => alignedPose(r.headBodyPoints, fit[i]));
  const motion = (poses: typeof after) => frames.slice(1).map((row, i) => footMotionRms(poses[i], poses[i + 1], frames[i].target, row.target));
  const faces = (poses: typeof after) => frames.slice(1).map((row, i) => faceMotionError(poses[i], poses[i + 1], frames[i].target, row.target));
  const lean = (poses: typeof after) => frames.map((row, i) => Math.abs(torsoLeanError(poses[i], row.target)));
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  expect(Math.max(...faces(after))).toBeLessThan(Math.max(...faces(before)) / 2);
  expect(Math.max(...lean(after))).toBeLessThan(Math.max(...lean(before)));
  expect(mean(motion(after))).toBeLessThan(mean(motion(before)));
  for (const row of frames) {
    expect(row.headBodyPoints).toHaveLength(33);
    expect(row.headBodyPoints.flat().every(Number.isFinite)).toBe(true);
    const bytes = readFileSync(new URL(`./assets/pose-test/${row.headBody}`, import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(row.headBodyHash);
    expect(readFileSync(new URL(`./assets/pose-test/${row.upperGuide}`, import.meta.url)).length).toBeGreaterThan(1000);
  }
});
