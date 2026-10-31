import { test, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import manifest from './assets/gpt-quality/manifest.json';
import prompts from './assets/gpt-quality/prompts.json';
import data from './angles.json';

test('built-in restorations retain current source provenance and intact playback derivatives', () => {
  expect(manifest.assetVersion).toBe(data.assetVersion);
  expect(manifest.generated).toBe(manifest.frames.length);
  expect(new Set(manifest.frames.map(row => row.index)).size).toBe(manifest.generated);
  expect(prompts.map(row => row.index).sort((a, b) => a - b))
    .toEqual(manifest.frames.map(row => row.index).sort((a, b) => a - b));
  for (const row of manifest.frames) {
    expect(row.source).toBe(data.frames[row.index].source);
    expect(row.sourceFrame).toBe(data.frames[row.index].sourceFrame);
    expect(Object.values(row.qualityRegistration).every(Number.isFinite)).toBe(true);
    expect(row.qualityRegistration.scale).toBeGreaterThan(0);
    for (const [file, expected] of [[row.edited, row.editedSha256], [row.playback, row.playbackSha256]]) {
      const bytes = readFileSync(new URL(`./assets/gpt-quality/${file}`, import.meta.url));
      expect(createHash('sha256').update(bytes).digest('hex'), file).toBe(expected);
      expect(bytes.subarray(8, 12).toString(), file).toBe('WEBP');
    }
  }
});
