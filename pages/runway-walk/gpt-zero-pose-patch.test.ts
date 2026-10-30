import { test, expect } from 'vitest';
import pose from './assets/pose-test/manifest.json';
import restored from './assets/gpt-zero/manifest.json';
import photos from './angles.json';
import { zeroPoseAsset, zeroPoseFits } from './gpt-zero-pose-patch';
import { transformPhotoPoint } from './photo-registration';
import { ReferenceSequencer, cutIndex } from './reference-sequencer';
import { createWalkState } from './reference-clock';

test('the artwork cut applies the twelve-frame joint fit once, without a second pose transform', () => {
  const planner = new ReferenceSequencer(photos.frames);
  let state = createWalkState(), tick = 0;
  while (tick < 12) {
    const cut = planner.plan(0, state);
    for (let i = 0; i < cut.count && tick < 12; i++, tick++) {
      const row = pose.frames[tick], original = restored.frames.find(p => p.index === row.index)!;
      expect(cutIndex(cut, i)).toBe(row.index);
      const asset = zeroPoseAsset(original, true);
      expect(asset.patched).toBe(true);
      const outer = cut.photoTransforms![i];
      expect(outer).toEqual(row.oldCut);
      for (const point of row.headBodyPoints) {
        const actual = transformPhotoPoint(transformPhotoPoint(point, asset.registration!), outer);
        const expected = transformPhotoPoint(point, zeroPoseFits[tick]);
        expect(actual[0]).toBeCloseTo(expected[0], 10);
        expect(actual[1]).toBeCloseTo(expected[1], 10);
      }
    }
    state = cut.after;
  }
});
test('only the twelve reviewed sources are replaced; toggling keeps download identities distinct', () => {
  let count = 0;
  for (const row of restored.frames) {
    const original = zeroPoseAsset(row, false), revised = zeroPoseAsset(row, true);
    expect(original.file).toBe(`./assets/gpt-zero/${row.edited}`);
    expect(original.registration).toEqual(row.registration);
    if (pose.frames.some(p => p.index === row.index)) {
      count++;
      expect(revised.key).not.toBe(original.key);
      expect(revised.file).toMatch(/head-body-\d+\.webp$/);
    } else expect(revised).toEqual(original);
  }
  expect(count).toBe(12);
});
