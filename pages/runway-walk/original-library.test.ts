import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import original from './assets/quality-original/manifest.json';
import enhanced from './assets/quality/manifest.json';

test('pre-enhancement comparison has every selected original and intact source provenance', () => {
  expect(original.assetVersion).toBe(enhanced.assetVersion);
  expect(original.frames.map(row => row.index)).toEqual(enhanced.frames.map(row => row.index));
  const root = new URL('./assets/quality-original/', import.meta.url);
  expect(readdirSync(root).filter(file => file.endsWith('.webp')).sort()).toEqual(original.frames.map(row => row.file).sort());
  for (const row of original.frames) {
    expect(row.originRef).toBe('c8d352ef');
    expect(row.originPath).toContain('-original.webp');
    const bytes = readFileSync(new URL(row.file, root));
    expect(createHash('sha256').update(bytes).digest('hex'), row.file).toBe(row.sha256);
    expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
  }
});
