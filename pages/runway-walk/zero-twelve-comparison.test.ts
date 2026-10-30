import { test, expect } from 'vitest';
import pose from './assets/pose-test/manifest.json';
import restored from './assets/gpt-zero/manifest.json';
import { zeroTwelveFrames } from './zero-twelve-comparison';
import { zeroPoseAsset } from './gpt-zero-pose-patch';
import { transformPhotoPoint } from './photo-registration';

test('comparison shows exactly the same twelve artwork photos with revised poses off and on', () => {
  expect(zeroTwelveFrames).toHaveLength(12);
  for (const [tick, row] of zeroTwelveFrames.entries()) {
    const source = restored.frames.find(p => p.index === row.index)!;
    const before = zeroPoseAsset(source, false), after = zeroPoseAsset(source, true);
    expect(row.before).toBe(before.file);
    expect(row.after).toBe(after.file);
    const apply = (p: readonly number[], transforms: typeof row.beforeTransforms) => [...transforms].reverse().reduce((point, transform) => transformPhotoPoint(point, transform), [...p]);
    for (const p of pose.frames[tick].headBodyPoints) {
      const shownBefore = apply(p, row.beforeTransforms);
      const artworkBefore = apply(p, [pose.frames[tick].oldCut, before.registration!]);
      const shownAfter = apply(p, row.afterTransforms);
      const artworkAfter = apply(p, [pose.frames[tick].oldCut, after.registration!]);
      expect(shownBefore).toEqual(artworkBefore);
      expect(shownAfter[0]).toBeCloseTo(artworkAfter[0], 10);
      expect(shownAfter[1]).toBeCloseTo(artworkAfter[1], 10);
    }
  }
});
