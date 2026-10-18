import { expect, test } from 'vitest';
import { softenInkField } from './tone-field';

function face() {
  const width = 160;
  const height = 140;
  const source = new Float32Array(width * height);
  for (let y = 20; y < 120; y++) {
    for (let x = 20; x < 140; x++) {
      const border = x < 23 || x > 136 || y < 23 || y > 116;
      source[y * width + x] = border ? 1 : 0.45;
    }
  }
  return { source, width, height };
}

test('preserves eye whites, pupils, narrow mouth lines and sharp interior tone changes exactly', () => {
  const { source, width, height } = face();
  for (let y = 45; y < 65; y++) {
    for (let x = 45; x < 65; x++) source[y * width + x] = 0;
    for (let x = 53; x < 57; x++) source[y * width + x] = 1;
  }
  for (let x = 50; x < 110; x++) source[85 * width + x] = 1;
  for (let y = 90; y < 110; y++) {
    for (let x = 80; x < 120; x++) source[y * width + x] = 0.7;
  }
  const field = softenInkField(source, width, height);
  for (let y = 30; y < 110; y++) {
    for (let x = 30; x < 130; x++) expect(field[y * width + x]).toBe(source[y * width + x]);
  }
});

test('reduces the outer black contour and fades into surrounding paper while keeping the body tone', () => {
  const { source, width, height } = face();
  const field = softenInkField(source, width, height);
  for (let x = 20; x < 23; x++) expect(field[70 * width + x]).toBeLessThan(0.5);
  expect(field[70 * width + 26]).toBe(source[70 * width + 26]);
  expect(field[70 * width + 18]).toBeGreaterThan(0.05);
  expect(field[70 * width + 5]).toBe(0);
});

test('feathers a silhouette without changing its interior gradient', () => {
  const width = 160;
  const height = 100;
  const source = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < 80; x++) source[y * width + x] = 0.3 + x / 160;
  }
  const field = softenInkField(source, width, height);
  for (let x = 0; x < 74; x++) expect(field[50 * width + x]).toBe(source[50 * width + x]);
  expect(field[50 * width + 83]).toBeGreaterThan(0.05);
  expect(field[50 * width + 95]).toBe(0);
});
