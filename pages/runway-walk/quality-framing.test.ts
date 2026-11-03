import { test, expect } from 'vitest';
import { qualityFraming } from './quality-framing';
import { transformPhotoPoint } from './photo-registration';

test('source crop framing uses the renderer pivot without moving its origin or changing angle', () => {
  const fit = { scale: .97, dx: 5, dy: -3 }, transform = qualityFraming(fit);
  for (const [x, y] of [[0, 0], [1, 1], [.3, .7]]) {
    const point = transformPhotoPoint([x, y], transform);
    expect(point[0]).toBeCloseTo(x * fit.scale + fit.dx / 512, 10);
    expect(point[1]).toBeCloseTo(y * fit.scale + fit.dy / 768, 10);
  }
  expect(transform.rotation).toBe(0);
  expect(qualityFraming({ scale: 1, dx: 0, dy: 0 })).toEqual({ scale: 1, rotation: 0, dx: 0, dy: 0 });
});
