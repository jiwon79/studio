import { test, expect } from 'vitest';
import { qualityDirections, preservedOriginals } from './quality-coverage';
import { directionPhotos } from './direction-photos';

test('rejected edits preserve source frames without promoting other missing photos', () => {
  const photos = directionPhotos(30);
  const restored = new Set(photos.filter(index => !preservedOriginals.has(index)));
  expect(preservedOriginals.size).toBeGreaterThan(0);
  expect(qualityDirections(restored)).toContain(30);
  expect([...preservedOriginals].every(index => !restored.has(index))).toBe(true);
  restored.delete([...restored][0]);
  expect(qualityDirections(restored)).not.toContain(30);
});
