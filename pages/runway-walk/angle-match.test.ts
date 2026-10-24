import { expect, test } from 'vitest';
import data from './angles.json';
import { buildBlocks, chooseBlock, directionCoverage, phaseDistance, gaitDistance, type AngleFrame } from './angle-match';
const f = (clip: string, sourceFrame: number): AngleFrame => ({ clip, source: 'test', sourceFrame, yaw: 0, phase: 0, atlas: 0, tile: 0 });
test('three-frame blocks cannot cross source gaps or clip boundaries', () => {
  const blocks = buildBlocks([f('a',10),f('a',11),f('a',12),f('a',14),f('a',15),f('b',16),f('b',17),f('b',18)]);
  expect(blocks.map(b => b.start)).toEqual([0,5]);
});
test('angle selection takes priority; phase remains continuous across the loop', () => {
  const blocks = [
    { start: 0, yaw: -70, phase: 0.99, clip: 'left' },
    { start: 3, yaw: 0, phase: 0.01, clip: 'front' },
    { start: 6, yaw: -70, phase: 0.5, clip: 'left-other' },
  ];
  expect(chooseBlock(blocks,-60,0.01).start).toBe(0);
  expect(chooseBlock(blocks,0,0.99).start).toBe(3);
  expect(phaseDistance(0.99,0.01)).toBeCloseTo(0.02);
});

test('exported source atlas offers valid consecutive blocks for every stored direction', () => {
  const blocks = buildBlocks(data.frames);
  for (const yaw of new Set(data.frames.map(f => f.yaw))) {
    const chosen = chooseBlock(blocks,yaw,0.25);
    expect(Math.abs(chosen.yaw - yaw)).toBeLessThanOrEqual(15);
    const sequence = data.frames.slice(chosen.start, chosen.start+3);
    expect(sequence[2].sourceFrame - sequence[0].sourceFrame).toBe(2);
    expect(new Set(sequence.map(f => f.clip)).size).toBe(1);
  }
  for (const frame of data.frames) {
    expect(frame.atlas).toBeLessThan(data.atlases.length);
    expect(frame.tile).toBeLessThan(data.columns * data.rows);
    expect(frame.phase).toBeGreaterThanOrEqual(0);
    expect(frame.phase).toBeLessThan(1);
  }
});

test('a matching gait cannot pull a frontal person into a diagonal direction', () => {
  const blocks = [
    { start: 0, yaw: -45, phase: 0.5, clip: 'diagonal' },
    { start: 3, yaw: 0, phase: 0, clip: 'frontal' },
  ];
  expect(chooseBlock(blocks,-30,0).clip).toBe('diagonal');
});

test('a turn must match the requested direction for the entire three-frame hold', () => {
  const frames=[
    {...f('turn-away',10),yaw:-38}, {...f('turn-away',11),yaw:-46}, {...f('turn-away',12),yaw:-54},
    {...f('compatible',20),yaw:-38}, {...f('compatible',21),yaw:-39}, {...f('compatible',22),yaw:-40},
  ];
  expect(chooseBlock(buildBlocks(frames),-38,0).clip).toBe('compatible');
});

test('every selectable direction offers 100 real frames and eight distinct outfits', () => {
  const blocks = buildBlocks(data.frames);
  for (let yaw=-75; yaw<=0; yaw++) {
    const coverage = directionCoverage(data.frames,blocks,yaw,data.holdFrames);
    expect(coverage.outfits, `outfits at ${yaw}`).toBeGreaterThanOrEqual(8);
    expect(coverage.frames, `frames at ${yaw}`).toBeGreaterThanOrEqual(100);
  }
});
test('supplemental footage only adds deficient non-frontal directions', () => {
  const added=data.frames.filter(f=>f.source==='hermes');
  expect(new Set(added.map(f=>f.look)).size).toBeGreaterThanOrEqual(8);
  expect(added.every(f=>f.yaw<=-10)).toBe(true);
  for(const yaw of [-30,-35])expect(added.some(f=>f.yaw===yaw)).toBe(true);
  const turns=data.frames.filter(f=>f.source==='prada24');
  expect(new Set(turns.map(f=>f.look)).size).toBeGreaterThanOrEqual(8);
  expect(turns.every(f=>f.yaw<=-10)).toBe(true);
});
test('reviewed spectator-overlap frames stay out of the frontal library', () => {
  expect(data.frames.some(f=>f.clip==='gucci-look-179')).toBe(false);
  expect(data.frames.some(f=>f.clip==='fendi-look-1720'&&f.sourceFrame>=759)).toBe(false);
  expect(new Set(data.frames.filter(f=>f.yaw===0).map(f=>f.look)).size).toBe(10);
});
test('avoid recent outfits when another outfit has a nearby gait in the same direction', () => {
  const blocks = [
    {start:0,yaw:-45,phase:0,clip:'a'},
    {start:3,yaw:-45,phase:0.02,clip:'b'},
    {start:6,yaw:-45,phase:0.06,clip:'c'},
    {start:9,yaw:0,phase:0,clip:'wrong-direction'},
  ];
  expect(chooseBlock(blocks,-45,0,['a','b']).clip).toBe('c');
});
test('each representative direction visits several compatible outfits during playback', () => {
  const blocks = buildBlocks(data.frames);
  for (const yaw of [-75,-60,-38,-35,-30,-20,-15,-10,-5,0]) {
    let recent: string[]=[]; let previous: readonly number[] | undefined; let velocity: readonly number[] | undefined; const visited=new Set<string>();
    for (let cut=0; cut<120; cut++) {
      const block=chooseBlock(blocks,yaw,(cut/10)%1,recent,previous,velocity);
      const look=block.look ?? block.clip; visited.add(look); recent=[look,...recent].slice(0,4);
      previous=data.frames[block.start+2].gait;
      velocity=data.frames[block.start+2].gaitVelocity;
    }
    // Phase and joint continuity can narrow an eight-outfit source pool.
    expect(visited.size, `playback at ${yaw}`).toBeGreaterThanOrEqual(6);
  }
});
test('an approaching foot keeps moving in the same direction across an identity cut', () => {
  const pose = [0,0,0,0,0,0,0,0];
  const velocity = [.01,0,0,0,0,0,0,0];
  const blocks = [
    {start:0,yaw:-15,phase:0,clip:'reverse',gait:velocity,gaitVelocity:velocity.map(v=>-v)},
    {start:3,yaw:-15,phase:.01,clip:'forward',gait:velocity,gaitVelocity:velocity},
  ];
  expect(chooseBlock(blocks,-15,0,[],pose,velocity).clip).toBe('forward');
});
test('near-front directions have filmed intermediate views instead of repeating only frontal frames', () => {
  const blocks=buildBlocks(data.frames);
  for(const yaw of [-10,-15,-20]) {
    for(let step=0;step<30;step++) {
      const block=chooseBlock(blocks,yaw,step/30);
      expect(block.yaw).toBeLessThan(0);
      expect(Math.abs(block.yaw-yaw)).toBeLessThanOrEqual(5);
    }
  }
});
test('all exported source identities are unique and stay inside one camera shot', () => {
  expect(new Set(data.frames.map(f=>`${f.clip}:${f.sourceFrame}`)).size).toBe(data.frames.length);
  expect(new Set(data.frames.map(f=>`${f.source}:${f.sourceFrame}`)).size).toBe(data.frames.length);
  for (const clip of data.clips) {
    const frames=data.frames.filter(f=>f.clip===clip.id);
    expect(buildBlocks(frames).length,clip.id).toBeGreaterThan(0);
    for (const f of frames) {
      expect(f.sourceFrame).toBeGreaterThanOrEqual(clip.sourceSegment[0]);
      expect(f.sourceFrame).toBeLessThan(clip.sourceSegment[1]);
    }
  }
});
test('finale supplements contain only reviewed complete frames of one outfit', () => {
  for(const clip of data.clips.filter(c=>c.id.startsWith('hermes-turn-'))) {
    const allowed=new Set(clip.reviewedFrames);
    for(const f of data.frames.filter(f=>f.clip===clip.id))expect(allowed.has(f.sourceFrame)).toBe(true);
    expect(clip.screenPhaseCalibration?.reference).toBe(clip.phaseReference);
  }
});
test('38-degree selection excludes the misclassified Prada side shots', () => {
  const blocks=buildBlocks(data.frames);
  for(let step=0;step<30;step++)expect(chooseBlock(blocks,-38,step/30).clip.startsWith('prada-')).toBe(false);
});
test('registered stature and floor remain stable across the actual library', () => {
  const heights=data.frames.map(f=>f.registration.height).sort((a,b)=>a-b);
  const floors=data.frames.map(f=>f.registration.ground).sort((a,b)=>a-b);
  const p=(values: number[],q: number)=>values[Math.floor((values.length-1)*q)];
  expect(p(heights,.95)-p(heights,.05)).toBeLessThan(30);
  expect(p(floors,.95)-p(floors,.05)).toBeLessThan(15);
  for(const f of data.frames) {
    expect(f.gait.length).toBe(8);
    expect(f.gaitVelocity.length).toBe(8);
    expect(f.gait.every(v=>Number.isFinite(v)&&Math.abs(v)<1)).toBe(true);
  }
});
test('prefer compatible knee and ankle positions when phase estimates are close', () => {
  const previous = [-.08,.18,.08,.18,-.1,.35,.1,.35];
  const blocks = [
    {start:0,yaw:-45,phase:0,clip:'swapped-legs',gait:[.1,.18,-.1,.18,.2,.35,-.2,.35]},
    {start:3,yaw:-45,phase:.02,clip:'continuous',gait:previous},
    {start:6,yaw:0,phase:0,clip:'wrong-direction',gait:previous},
  ];
  expect(chooseBlock(blocks,-38,0,[],previous).clip).toBe('continuous');
  expect(gaitDistance(previous,previous)).toBe(0);
});
