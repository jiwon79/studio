import { test, expect } from 'vitest';
import { footPose, legPose, pelvisHeight, STRIDE, SHIN_LENGTH, THIGH_LENGTH, wrapPosition } from './motion';

test('a planted foot stays fixed as the person advances', () => {
  const stride = 88;
  const a = footPose(.1, stride);
  const b = footPose(.5, stride);
  expect(.1 * stride + a.forward).toBeCloseTo(.5 * stride + b.forward);
  expect(a.lift).toBe(0);
  expect(b.lift).toBe(0);
});
test('swing lifts the foot and returns continuously to the next planted step', () => {
  expect(footPose(.81, 88).lift).toBeCloseTo(1);
  expect(footPose(.999999, 88).forward).toBeCloseTo(footPose(1, 88).forward, 3);
  expect(footPose(.619999, 88).forward).toBeCloseTo(footPose(.620001, 88).forward, 3);
});
test('routes wrap outside the viewport with space for the entire body', () => {
  expect(wrapPosition(1200, 1000, 200)).toBe(-200);
  expect(wrapPosition(-201, 1000, 200)).toBe(1199);
});


test('knees preserve both bone lengths throughout the walking cycle', () => {
  for (let i = 0; i < 200; i++) {
    const cycle = i / 200;
    const { hip, knee, ankle } = legPose(footPose(cycle, STRIDE), pelvisHeight(cycle));
    const length = (a: typeof hip, b: typeof hip) => Math.hypot(a.forward - b.forward, a.height - b.height);
    expect(length(hip, knee)).toBeCloseTo(THIGH_LENGTH, 6);
    expect(length(knee, ankle)).toBeCloseTo(SHIN_LENGTH, 6);
    expect(knee.height).toBeGreaterThan(ankle.height);
    expect(knee.height).toBeLessThan(hip.height);
  }
});

test('swing and stance join without a sudden change of foot velocity', () => {
  const delta = .00001;
  for (const boundary of [.62, 1]) {
    const before = (footPose(boundary, STRIDE).forward - footPose(boundary - delta, STRIDE).forward) / delta;
    const after = (footPose(boundary + delta, STRIDE).forward - footPose(boundary, STRIDE).forward) / delta;
    expect(Math.abs(after - before)).toBeLessThan(.04);
    expect(footPose(boundary - delta, STRIDE).roll).toBeCloseTo(footPose(boundary + delta, STRIDE).roll, 3);
  }
});

test('alternating feet always leave at least one foot on the glass', () => {
  for (let i = 0; i < 200; i++) {
    expect(Math.min(footPose(i / 200, STRIDE).lift, footPose(i / 200 + .5, STRIDE).lift)).toBe(0);
  }
});


test('support transfer stays continuous and avoids a crouched gait', () => {
  let maxStance = 0;
  let maxSwing = 0;
  for (let i = 0; i < 1000; i++) {
    const cycle = i / 1000;
    const height = pelvisHeight(cycle);
    expect(Math.abs(height - pelvisHeight(cycle + .00001))).toBeLessThan(.01);
    const foot = footPose(cycle, STRIDE);
    const { hip, knee, ankle } = legPose(foot, height);
    const a = [hip.forward - knee.forward, hip.height - knee.height];
    const b = [ankle.forward - knee.forward, ankle.height - knee.height];
    const bend = 180 - Math.acos((a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b))) * 180 / Math.PI;
    if (foot.lift === 0) maxStance = Math.max(maxStance, bend);
    else maxSwing = Math.max(maxSwing, bend);
  }
  expect(maxStance).toBeLessThan(50);
  expect(maxSwing).toBeLessThan(55);
});
