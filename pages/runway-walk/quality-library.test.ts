import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import manifest from './assets/quality/manifest.json';
import provenance from './assets/quality/provenance.json';
import data from './angles.json';
import excluded from './quality-originals.json';
import { directionPhotos } from './direction-photos';
import { ReferenceSequencer } from './reference-sequencer';

test('the final library contains exactly the scheduled enhanced photographs and intact files', () => {
  const active = [...new Set(Array.from({ length: 37 }, (_, i) => i * 5 - 90).flatMap(directionPhotos))].sort((a, b) => a - b);
  expect(manifest.assetVersion).toBe(data.assetVersion);
  expect(manifest.frames.map(row => row.index)).toEqual(active);
  expect(provenance.map(row => row.index)).toEqual(active);
  const root = new URL('./assets/quality/', import.meta.url);
  expect(readdirSync(root).filter(file => file.endsWith('.webp')).sort()).toEqual(manifest.frames.map(row => row.file).sort());
  for (const row of manifest.frames) {
    expect(excluded.frames).not.toContain(row.index);
    const bytes = readFileSync(new URL(row.file, root));
    expect(createHash('sha256').update(bytes).digest('hex'), row.file).toBe(row.sha256);
    expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
    expect(Object.values(row.registration).every(Number.isFinite)).toBe(true);
    expect(row.registration.scale).toBeGreaterThan(0);
  }
});

test('direction-change fallback candidates also have final photographs', () => {
  // A separately parsed library must obey the same availability guard.
  const frames = JSON.parse(JSON.stringify(data.frames));
  const planner = new ReferenceSequencer(frames);
  const allowed = new Set(manifest.frames.map(row => row.index));
  for (let yaw = -90; yaw <= 90; yaw += 5) for (const count of [1, 2, 3]) {
    for (const block of planner.candidates(yaw, count)) {
      for (let offset = 0; offset < count; offset++) expect(allowed.has(block.start + offset)).toBe(true);
    }
  }
});
