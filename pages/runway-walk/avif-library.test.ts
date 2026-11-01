import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import optimized from './assets/quality-avif/manifest.json';
import fallback from './assets/quality/manifest.json';

test('every AVIF matches the final photograph and bounded alpha recipe', () => {
  expect(optimized.assetVersion).toBe(fallback.assetVersion);
  expect(optimized.recipe.resize).toBe(false);
  expect(optimized.recipe.alphaQuality).toBe(100);
  expect(optimized.frames.map(row => row.index)).toEqual(fallback.frames.map(row => row.index));
  const sources = new Map(fallback.frames.map(row => [row.index, row]));
  const root = new URL('./assets/quality-avif/', import.meta.url);
  expect(readdirSync(root).filter(file => file.endsWith('.avif')).sort()).toEqual(optimized.frames.map(row => row.file).sort());
  let total = 0;
  for (const row of optimized.frames) {
    expect(row.fallbackSha256).toBe(sources.get(row.index)!.sha256);
    expect(row.alphaMaxError).toBeLessThanOrEqual(4);
    expect(row.width / row.height).toBeCloseTo(2 / 3, 2);
    const bytes = readFileSync(new URL(row.file, root));
    expect(createHash('sha256').update(bytes).digest('hex'), row.file).toBe(row.sha256);
    expect(bytes.subarray(4, 8).toString()).toBe('ftyp');
    expect(bytes.subarray(8, 12).toString()).toBe('avif');
    expect(bytes.length).toBe(row.bytes);
    total += bytes.length;
  }
  expect(total).toBe(optimized.bytes);
  expect(total).toBeLessThan(optimized.fallbackBytes);
});
