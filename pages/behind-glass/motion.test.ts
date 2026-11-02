import { test, expect } from 'vitest';
import { footPose, wrapPosition } from './motion';

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
