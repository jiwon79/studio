import { test, expect } from 'vitest';
import data from './angles.json';
import schedule from './reference-schedule.json';
import manifest from './assets/gpt-zero/manifest.json';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

test('GPT restoration covers each unique photo in the entire 0 degree edit', () => {
  const indices = [...new Set(schedule.directions['0'].flatMap(entry => typeof entry === 'number' ? [entry, entry + 1, entry + 2] : entry))];
  expect(manifest.assetVersion).toBe(data.assetVersion);
  expect(indices.length).toBe(114);
  expect(manifest.frames.map(row => row.index).sort((a, b) => a - b)).toEqual(indices.sort((a, b) => a - b));
  for (const row of manifest.frames) {
    expect(row.source).toBe(data.frames[row.index].source);
    expect(row.sourceFrame).toBe(data.frames[row.index].sourceFrame);
    expect(Object.values(row.registration).every(Number.isFinite)).toBe(true);
    expect(row.registration.scale).toBeGreaterThanOrEqual(.85);
    expect(row.registration.scale).toBeLessThanOrEqual(1.1);
    expect(Math.abs(row.registration.rotation)).toBeLessThan(.05);
    expect(Math.max(Math.abs(row.registration.dx), Math.abs(row.registration.dy))).toBeLessThan(32);
    for (const name of [row.original, row.edited]) {
      const path = fileURLToPath(new URL(`./assets/gpt-zero/${name}`, import.meta.url));
      expect(existsSync(path), name).toBe(true);
      const bytes = readFileSync(path);
      const expectedHash = name === row.original ? row.originalSha256 : row.editedSha256;
      expect(createHash('sha256').update(bytes).digest('hex'), name).toBe(expectedHash);
      if (name === row.edited) {
        expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
        expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
        continue;
      }
      expect(bytes.subarray(1, 4).toString()).toBe('PNG');
      expect(bytes[25], name).toBe(6); // RGBA: retain the generated transparency.
      expect(bytes.readUInt32BE(16), name).toBe(512);
      expect(bytes.readUInt32BE(20), name).toBe(768);
    }
  }
});
