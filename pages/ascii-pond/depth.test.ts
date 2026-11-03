import { expect, test } from 'vitest';
import { DepthMotion, fishDepth } from './depth';

test('fish smoothly dive and surface on independent bounded vertical trajectories', () => {
  let largestStep = 0;
  for (let i = 0; i < 10; i++) {
    let minimum = 1, maximum = 0;
    let previous = fishDepth(i);
    for (let frame = 0; frame <= 1800; frame++) {
      const profile = fishDepth(i, frame / 60);
      minimum = Math.min(minimum, profile.depth); maximum = Math.max(maximum, profile.depth);
      largestStep = Math.max(largestStep, Math.abs(profile.depth - previous.depth));
      expect(profile.scale).toBeGreaterThanOrEqual(0.84);
      expect(profile.scale).toBeLessThanOrEqual(1.08);
      expect(profile.z).toBeLessThanOrEqual(0);
      previous = profile;
    }
    expect(minimum).toBeLessThan(0.01);
    expect(maximum).toBeGreaterThan(0.99);
  }
  expect(largestStep).toBeLessThan(0.003);
  expect(fishDepth(0, 5).depth).not.toBeCloseTo(fishDepth(1, 5).depth);
});

test('selection freezes depth and resumes from the same place instead of catching up', () => {
  const motion = new DepthMotion();
  motion.sample(2, 20, false);
  const fixed = motion.sample(2, 21, false);
  expect(motion.sample(2, 22, true)).toEqual(fixed);
  expect(motion.sample(2, 30, true)).toEqual(fixed);
  expect(motion.sample(2, 30, false)).toEqual(fixed);
  expect(motion.sample(2, 30 + 1 / 60, false)).toEqual(fishDepth(2, 21 + 1 / 60));
});

test('new and reused fish start shallow at any simulation time, then dive smoothly', () => {
  const motion = new DepthMotion();
  for (const index of [0, 10, 25, 63]) {
    motion.sample(index, 20, false);
    for (const createdAt of [80, 150]) {
      motion.startAtSurface(index, createdAt);
      expect(motion.sample(index, createdAt, false).depth).toBeCloseTo(0);
      expect(motion.sample(index, createdAt + 1 / 60, false).depth).toBeLessThan(0.001);
      expect(motion.sample(index, createdAt + 6, false).depth).toBeGreaterThan(0.4);
    }
  }
});

test('diving tilt changes 3D geometry without shifting its editable screen outline', async () => {
  const { FishGeometry } = await import('./geometry');
  const spine = new Float32Array(20);
  for (let k = 0; k < 10; k++) spine.set([0.8 - k * 0.02, 0.5], k * 2);
  const geometry = new FishGeometry(0);
  geometry.update(spine, 0, 0, 1, 0);
  const before = geometry.getAttribute('position').array.slice();
  geometry.update(spine, 0, 0, 1, 0.2);
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  let maxLift = 0;
  for (let k = 0; k < geometry.drawRange.count; k++) {
    expect(positions.getX(k)).toBe(before[k * 3]);
    expect(positions.getY(k)).toBe(before[k * 3 + 1]);
    expect(Number.isFinite(normals.getX(k) + normals.getY(k) + normals.getZ(k))).toBe(true);
    maxLift = Math.max(maxLift, positions.getZ(k) - before[k * 3 + 2]);
  }
  expect(maxLift).toBeGreaterThan(0.03);
  geometry.dispose();
});
