import { expect, test } from 'vitest';
import data from './angles.json';
import { buildBlocks, chooseBlock, phaseDistance, type AngleFrame } from './angle-match';
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

test('every selectable direction has at least four reviewed outfit candidates', () => {
  const blocks = buildBlocks(data.frames);
  for (let yaw=-75; yaw<=0; yaw++) {
    const nearest = Math.min(...blocks.map(b=>Math.abs(b.yaw-yaw)));
    const outfits = new Set(blocks.filter(b=>Math.abs(b.yaw-yaw)<=nearest+5).map(b=>b.look ?? b.clip));
    expect(outfits.size, `direction ${yaw}`).toBeGreaterThanOrEqual(4);
  }
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
test('each representative direction actually visits four outfits during playback', () => {
  const blocks = buildBlocks(data.frames);
  for (const yaw of [-75,-60,-45,0]) {
    let recent: string[]=[]; const visited=new Set<string>();
    for (let cut=0; cut<120; cut++) {
      const block=chooseBlock(blocks,yaw,(cut/10)%1,recent);
      const look=block.look ?? block.clip; visited.add(look); recent=[look,...recent].slice(0,4);
    }
    expect(visited.size, `playback at ${yaw}`).toBeGreaterThanOrEqual(4);
  }
});
