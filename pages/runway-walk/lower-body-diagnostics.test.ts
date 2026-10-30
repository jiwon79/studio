import { test, expect } from 'vitest';
import { lowerBodyShape } from './lower-body-diagnostics';
import { projectReference, referencePose } from './gait-reference';
import { transformPhotoPoint } from './photo-registration';
import { footRms } from './pose-test-metrics';

test('whole-photo registration cannot improve the measured calf or shoe proportions', () => {
  const p = projectReference(referencePose(.18));
  const changed = p.map(point => transformPhotoPoint(point, { scale: .92, rotation: .04, dx: 14, dy: -12 }));
  const a = lowerBodyShape(p, 'right'), b = lowerBodyShape(changed, 'right');
  expect(a.calfToThigh).toBeCloseTo(b.calfToThigh!, 10);
  expect(a.footToCalf).toBeCloseTo(b.footToCalf!, 10);
});
test('a wrong knee is detected even when every foot point stays identical', () => {
  const p = projectReference(referencePose(.18)), changed = p.map(point => [...point]);
  changed[26][1] += 40 / 768;
  expect(footRms(changed, p)).toBe(0);
  expect(Math.abs(lowerBodyShape(changed, 'right').calfToThigh! - lowerBodyShape(p, 'right').calfToThigh!)).toBeGreaterThan(.2);
  changed[30][2] = .2;
  expect(lowerBodyShape(changed, 'right').confidence).toBe(.2);
});
