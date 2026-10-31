import { test, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import manifest from './assets/higgsfield-quality-45/manifest.json';
import additional from './assets/higgsfield-quality/manifest.json';
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
    expect(hash(row.playback)).toBe(row.playbackSha256);
    expect(row.parameters.background).toBe('transparent');
    expect(row.parameters.quality).toBe('high');
  }
});

test('only directions with every scheduled photograph are promoted from the additional queue', () => {
  const added = additional as { assetVersion: string; generated: number; completeDirections: number[]; frames: { index: number; source: string; sourceFrame: number; edited: string; editedSha256: string; playback: string; playbackSha256: string }[] };
  const byIndex = new Set([...manifest.frames, ...added.frames].map(row => row.index));
  const complete = Array.from({ length: 37 }, (_, i) => i * 5 - 90).filter(yaw => directionPhotos(yaw).every(index => byIndex.has(index)));
  expect(added.assetVersion).toBe(data.assetVersion);
  expect(added.completeDirections).toEqual(complete);
  expect(added.generated).toBe(added.frames.length);
  for (const row of added.frames) {
    expect(row.source).toBe(data.frames[row.index].source);
    expect(row.sourceFrame).toBe(data.frames[row.index].sourceFrame);
    const bytes = readFileSync(new URL(`./assets/higgsfield-quality/${row.edited}`, import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(row.editedSha256);
    const playback = readFileSync(new URL(`./assets/higgsfield-quality/${row.playback}`, import.meta.url));
    expect(createHash('sha256').update(playback).digest('hex')).toBe(row.playbackSha256);
  }
});
