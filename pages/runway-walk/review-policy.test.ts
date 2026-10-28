import { test, expect } from 'vitest';
import { blockHeld, heldForTarget } from './review-policy';
import data from './angles.json';
import previews from './drag.json';
import { buildBlocks, directionCandidates, directionCoverage } from './angle-match';
import { ReferenceSequencer, cutIndex } from './reference-sequencer';
import { createWalkState } from './reference-clock';

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

test('reviewed frontal shots cannot return to shallow-angle playback or dragging',()=> {
  const rejected = [
    {clip:'prada25-nearfront-83',sourceFrame:2051,target:10},
    {clip:'hermes24-clean-175',sourceFrame:4400,target:10},
    {clip:'hermes24-clean-563',sourceFrame:14068,target:10},
    {clip:'prada24-turn-49',sourceFrame:1210,target:-10},
    {clip:'prada24-turn-81',sourceFrame:2024,target:-10},
    {clip:'prada24-turn-208',sourceFrame:5200,target:-10},
    {clip:'prada24-turn-208',sourceFrame:5206,target:-10},
    {clip:'prada24-turn-81',sourceFrame:2031,target:-10},
    {clip:'prada24-turn-99',sourceFrame:2478,target:-10},
    {clip:'hermes24-shallow-126',sourceFrame:3138,target:-10},
    {clip:'hermes-side-475',sourceFrame:11890,target:-20},
    {clip:'issey19-left-38',sourceFrame:952,target:-25},
    {clip:'dries24-right-113',sourceFrame:2825,target:20},
  ];
  for(const frame of rejected) {
    expect(heldForTarget(frame,frame.target)).toBe(true);
    if(frame.target===10)expect(heldForTarget(frame,15)).toBe(true);
  }
  const planner=new ReferenceSequencer(data.frames);
  for(let yaw=-90;yaw<=90;yaw+=5) {
    let state=createWalkState();
    const photos=new Set<string>(),looks=new Set<string>();
    while(state.tick<600) {
      const cut=planner.plan(yaw,state);
      expect(cut.qualityVerified).toBe(true);
      for(let j=0;j<cut.count;j++) {
        const frame=data.frames[cutIndex(cut,j)];
        expect(heldForTarget(frame,yaw)).toBe(false);
        photos.add(`${frame.source}:${frame.sourceFrame}`);looks.add(frame.look);
      }
      state=cut.after;
    }
    // Count the photographs actually displayed, rather than the candidate pool.
    // Keep the user's accepted +60° edit unchanged (89 photographs).
    expect(photos.size,`${yaw}° displayed photographs`).toBeGreaterThanOrEqual(yaw===60?89:100);
    expect(looks.size,`${yaw}° displayed outfits`).toBeGreaterThanOrEqual(8);
  }
});
