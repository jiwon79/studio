import { expect, test } from 'vitest';
import { prepareLiveDirection } from './live-direction';

test('a late direction decode enters the live frame instead of rewinding playback', async () => {
  let tick = 10;
  const decoded = new Set<number>();
  const plans: number[] = [];
  const result = await prepareLiveDirection({
    current: () => true,
    plan: () => { plans.push(tick); return [tick, tick + 1]; },
    available: frame => decoded.has(frame),
    prepare: async frame => {
      decoded.add(frame);
      // Playback continues while the first pair of pictures is decoded.
      if (frame === 10) tick += 2;
    },
  });
  expect(plans).toEqual([10, 12, 12]);
  expect(result).toEqual([12, 13]);
  expect(tick).toBe(12);
});

test('rapid reversal discards the older request even if it finishes decoding last', async () => {
  let yaw = 20;
  let finish!: () => void;
  const wait = new Promise<void>(resolve => { finish = resolve; });
  const old = prepareLiveDirection({
    current: () => yaw === 20,
    plan: () => [20],
    available: () => false,
    prepare: () => wait,
  });
  yaw = -20;
  const latest = await prepareLiveDirection({
    current: () => yaw === -20,
    plan: () => [-20],
    available: () => true,
    prepare: async () => { throw new Error('Resident pixels need no decoding'); },
  });
  finish();
  expect(await old).toBeUndefined();
  expect(latest).toEqual([-20]);
});

test('paused scrubbing does not advance the frame or commit speculative history', async () => {
  const observed = [1, 2, 3];
  let decoded = false;
  const histories: number[][] = [];
  const result = await prepareLiveDirection({
    current: () => true,
    plan: () => { histories.push([...observed]); return [4, 5]; },
    available: () => decoded,
    prepare: async () => { decoded = true; },
  });
  expect(result).toEqual([4, 5]);
  expect(histories).toEqual([[1, 2, 3], [1, 2, 3]]);
  expect(observed).toEqual([1, 2, 3]);
});

test('decode failures remain visible to the player rather than leaving a pending request', async () => {
  await expect(prepareLiveDirection({
    current: () => true,
    plan: () => [0],
    available: () => false,
    prepare: async () => { throw new Error('decode failed'); },
  })).rejects.toThrow('decode failed');
});
