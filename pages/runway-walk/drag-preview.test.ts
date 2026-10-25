import { expect, test } from 'vitest';
import data from './angles.json';
import previews from './drag.json';

test('resident drag previews match the published source and every requested direction', () => {
  expect(previews.sourceAssetVersion).toBe(data.assetVersion);
  expect(previews.yawRange).toEqual(data.yawRange);
  expect(previews.lookup.length).toBe(data.yawRange[1] - data.yawRange[0] + 1);
  for (const [direction, slots] of previews.lookup.entries()) {
    expect(slots.length).toBe(previews.phases);
    for (const slot of slots) {
      const tile = previews.tiles[slot];
      const frame = data.frames[tile.frame];
      expect(Math.abs(frame.yaw - (direction + data.yawRange[0]))).toBeLessThanOrEqual(5);
      expect(tile.atlas).toBeLessThan(previews.atlases.length);
      expect(tile.tile).toBeLessThan(previews.columns * previews.rows);
      expect(data.frames[tile.frame + 2].sourceFrame).toBe(frame.sourceFrame + 2);
      expect(data.frames[tile.frame + 2].clip).toBe(frame.clip);
    }
  }
});

test('all decoded drag pages stay within the mobile preview memory budget', () => {
  const bytes = previews.atlases.length * previews.columns * previews.rows * previews.tileWidth * previews.tileHeight * 4;
  expect(bytes).toBeLessThanOrEqual(80 * 1024 * 1024);
});
