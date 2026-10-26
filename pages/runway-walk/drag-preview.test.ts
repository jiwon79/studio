import { expect, test } from 'vitest';
import data from './angles.json';
import previews from './drag.json';

test('resident drag previews match the published source and every requested direction', () => {
  expect(previews.sourceAssetVersion).toBe(data.assetVersion);
  expect(previews.yawRange).toEqual(data.yawRange);
  expect(previews.yawStep).toBe(5);
  expect(previews.lookup.length).toBe((data.yawRange[1] - data.yawRange[0])/5 + 1);
  expect(previews.tileWidth).toBe(data.tileWidth);
  expect(previews.tileHeight).toBe(data.tileHeight);
  expect(previews.quality).toBe('lossless-original-pixels');
  for (const [direction, slots] of previews.lookup.entries()) {
    expect(slots.length).toBe(previews.phases);
    for (const slot of slots) {
      const tile = previews.tiles[slot];
      const frame = data.frames[tile.frame];
      expect(Math.abs(frame.yaw - (direction*previews.yawStep + data.yawRange[0]))).toBeLessThanOrEqual(5);
      expect(tile.atlas).toBeLessThan(previews.atlases.length);
      const page = previews.pages[tile.atlas];
      expect(tile.x+tile.width).toBeLessThanOrEqual(page.width);
      expect(tile.y+tile.height).toBeLessThanOrEqual(page.height);
      expect(tile.offsetX+tile.width).toBeLessThanOrEqual(data.tileWidth);
      expect(tile.offsetY+tile.height).toBeLessThanOrEqual(data.tileHeight);
      expect(data.frames[tile.frame + 2].sourceFrame).toBe(frame.sourceFrame + 2);
      expect(data.frames[tile.frame + 2].clip).toBe(frame.clip);
    }
  }
});

test('all decoded drag pages stay within the mobile preview memory budget', () => {
  const bytes = previews.pages.reduce((sum,page)=>sum+page.width*page.height*4,0);
  expect(bytes).toBeLessThanOrEqual(224 * 1024 * 1024);
  for(const page of previews.pages) {
    expect(page.width).toBeLessThanOrEqual(2048);
    expect(page.height).toBeLessThanOrEqual(2048);
  }
});

test('drag photographs use the same fixed anatomical 3D reference as HD playback',async()=> {
  const {ReferenceSequencer}=await import('./reference-sequencer');
  const {default:matches}=await import('./reference-matches.json');
  const planner=new ReferenceSequencer(data.frames);
  expect(previews.selector).toBe(matches.version);
  expect(previews.referenceMatchVersion).toBe(matches.matchVersion);
  previews.lookup.forEach((slots,direction)=>slots.forEach((slot,phase)=> {
    const tile=previews.tiles[slot];
    expect(planner.inspect(tile.frame,0,direction*5-90,phase/previews.phases).oppositeFits).toBe(false);
  }));
});
