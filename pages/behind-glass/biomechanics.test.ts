import { test, expect } from 'vitest';
import { biomechanicalLeg } from './biomechanics';
import clip from './data/opensim-walk.json';

const length = (a: { forward: number; height: number; lateral: number }, b: typeof a) =>
  Math.hypot(a.forward-b.forward, a.height-b.height, a.lateral-b.lateral);

test('OpenSim joint trajectories stay finite, above ground, and keep the rigid shank length', () => {
  for (let i = 0; i < 1000; i++) for (const side of [-1, 1]) {
    const leg = biomechanicalLeg(i / 1000, side);
    for (const p of [leg.hip, leg.knee, leg.ankle, leg.contact]) {
      expect(Number.isFinite(p.forward + p.height + p.lateral)).toBe(true);
      expect(p.height).toBeGreaterThan(0);
    }
    expect(length(leg.knee, leg.ankle)).toBeCloseTo(51.0078, 2);
    // OpenSim's coupled knee translations vary the hip-to-knee-origin distance.
    expect(length(leg.hip, leg.knee)).toBeGreaterThan(54);
    expect(length(leg.hip, leg.knee)).toBeLessThan(57);
  }
});

test('the loop joins with continuous positions and velocities for both legs', () => {
  const dt = .00001;
  for (const side of [-1, 1]) {
    const before = biomechanicalLeg(1-dt, side), at = biomechanicalLeg(0, side), after = biomechanicalLeg(dt, side);
    for (const joint of ['hip','knee','ankle','contact'] as const) {
      expect(length(before[joint], at[joint])).toBeLessThan(.01);
      for (const axis of ['forward','height','lateral'] as const) {
        const left = (at[joint][axis]-before[joint][axis])/dt;
        const right = (after[joint][axis]-at[joint][axis])/dt;
        expect(Math.abs(left-right)).toBeLessThan(.2);
      }
    }
  }
});

test('sampling preserves the OpenSim frame coordinates instead of rebuilding knees with legacy IK', () => {
  const i = 37;
  const leg = biomechanicalLeg(i / clip.frames.length, -1);
  expect(leg.knee.forward).toBeCloseTo(clip.frames[i][0][1][0], 5);
  expect(leg.knee.height).toBeCloseTo(clip.frames[i][0][1][1], 5);
  expect(leg.knee.lateral).toBeCloseTo(-clip.frames[i][0][1][2], 5);
});
