import { test, expect } from 'vitest';
import { blockHeld, heldForTarget } from './review-policy';
import data from './angles.json';
import previews from './drag.json';
import { buildBlocks, directionCandidates, directionCoverage } from './angle-match';

test('review holds affect every source frame in a cut and only their reviewed target views',()=> {
  expect(blockHeld('hermes25-right-477',11929,11931,10)).toBe(true);
  expect(blockHeld('hermes25-right-477',11930,11932,20)).toBe(false);
  const blocks=buildBlocks(data.frames);
  for (let yaw=-90;yaw<=90;yaw+=5) {
    for (const block of directionCandidates(blocks,yaw)) {
      expect(data.frames.slice(block.start,block.start+3).some(f=>heldForTarget(f,yaw))).toBe(false);
    }
    const coverage=directionCoverage(data.frames,blocks,yaw);
    expect(coverage.outfits,`outfits at ${yaw}`).toBeGreaterThanOrEqual(8);
  }
  previews.lookup.forEach((row,direction)=>row.forEach(tile=> {
    expect(heldForTarget(data.frames[previews.tiles[tile].frame],-90+direction*5)).toBe(false);
  }));
});
