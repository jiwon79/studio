import { test, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import manifest from './assets/higgsfield-quality-45/manifest.json';
import data from './angles.json';
import { directionPhotos } from './direction-photos';

test('Higgsfield restoration covers every scheduled +45 photo from the current library', () => {
  const expected = directionPhotos(45).sort((a, b) => a - b);
  expect(manifest.assetVersion).toBe(data.assetVersion);
  expect(manifest.frames.map(row => row.index).sort((a, b) => a - b)).toEqual(expected);
  expect(manifest.generated).toBe(expected.length);
  expect(manifest.tool).toBe('Higgsfield API');
  for (const row of manifest.frames) {
    expect(row.source).toBe(data.frames[row.index].source);
    expect(row.sourceFrame).toBe(data.frames[row.index].sourceFrame);
    const hash = (name: string) => createHash('sha256').update(readFileSync(new URL(`./assets/higgsfield-quality-45/${name}`, import.meta.url))).digest('hex');
    expect(hash(row.edited)).toBe(row.editedSha256);
    expect(row.parameters.background).toBe('transparent');
    expect(row.parameters.quality).toBe('high');
  }
});
