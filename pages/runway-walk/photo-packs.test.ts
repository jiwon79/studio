import { test, expect } from 'vitest';
import { unpackPhotographs, type PhotoPack } from './photo-packs';

const pack: PhotoPack = { url: '/photos.bin', length: 7, entries: [
  { index: 12, offset: 0, length: 3 }, { index: 24, offset: 3, length: 4 },
] };

test('unpacking preserves every byte and image type without recompression', async () => {
  const photos = unpackPhotographs(pack, new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7])]));
  expect([...new Uint8Array(await photos.get(12)!.arrayBuffer())]).toEqual([1, 2, 3]);
  expect([...new Uint8Array(await photos.get(24)!.arrayBuffer())]).toEqual([4, 5, 6, 7]);
  expect(photos.get(12)!.type).toBe('image/webp');
  expect(unpackPhotographs({ ...pack, mime: 'image/avif' }, new Blob([new Uint8Array(7)])).get(12)!.type).toBe('image/avif');
});

test('partial downloads, gaps, duplicate IDs and unindexed tails fail before playback', () => {
  const blob = new Blob([new Uint8Array(7)]);
  expect(() => unpackPhotographs(pack, new Blob([new Uint8Array(6)]))).toThrow();
  expect(() => unpackPhotographs({ ...pack, entries: [{ index: 12, offset: 1, length: 6 }] }, blob)).toThrow();
  expect(() => unpackPhotographs({ ...pack, entries: [pack.entries[0], { ...pack.entries[1], index: 12 }] }, blob)).toThrow();
  expect(() => unpackPhotographs({ ...pack, entries: [pack.entries[0]] }, blob)).toThrow();
});
