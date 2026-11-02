import { expect, test } from 'vitest';
import { fishDepth } from './depth';

test('the school spans shallow and deep water with stable depth and perspective', () => {
  const profiles = Array.from({ length: 64 }, (_, i) => fishDepth(i));
  expect(fishDepth(0)).toEqual({ depth: 0, scale: 1, z: -0 });
  expect(Math.max(...profiles.slice(0, 10).map(p => p.depth))).toBeGreaterThan(0.9);
  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    expect(profile).toEqual(fishDepth(i));
    expect(profile.depth).toBeGreaterThanOrEqual(0);
    expect(profile.depth).toBeLessThanOrEqual(1);
    expect(profile.scale).toBeGreaterThanOrEqual(0.86);
    expect(profile.z).toBeLessThanOrEqual(0);
  }
  const sorted = profiles.sort((a, b) => a.depth - b.depth);
  for (let i = 1; i < sorted.length; i++) {
    expect(sorted[i].scale).toBeLessThanOrEqual(sorted[i - 1].scale);
    expect(sorted[i].z).toBeLessThanOrEqual(sorted[i - 1].z);
  }
});
