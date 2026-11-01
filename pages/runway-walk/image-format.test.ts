import { test, expect, vi } from 'vitest';
import { supportsAvif } from './image-format';
import manifest from './assets/quality/manifest.json';

test('the local AVIF probe closes its bitmap and handles unsupported decoders', async () => {
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close })));
  try {
    expect(await supportsAvif()).toBe(true);
    expect(close).toHaveBeenCalledOnce();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('Unsupported AVIF'); }));
    expect(await supportsAvif()).toBe(false);
  } finally { vi.unstubAllGlobals(); }
});

test('an unsupported AVIF browser downloads only the complete WebP fallback', async () => {
  const packs = Array.from({ length: Math.ceil(manifest.frames.length / 64) }, (_, i) => {
    const rows = manifest.frames.slice(i * 64, i * 64 + 64);
    return { url: `/webp-${i}.bin`, length: rows.length,
      entries: rows.map((row, offset) => ({ index: row.index, offset, length: 1 })) };
  });
  vi.stubGlobal('__RUNWAY_PHOTO_PACKS__', { webp: packs, avif: packs.map(pack => ({ ...pack, url: pack.url.replace('webp', 'avif') })) });
  vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('Unsupported AVIF'); }));
  const fetchPhoto = vi.fn(async (url: string) => ({ ok: true, blob: async () => new Blob([new Uint8Array(packs.find(pack => pack.url === url)!.length)]) }));
  vi.stubGlobal('fetch', fetchPhoto);
  try {
    const { qualityLibrary } = await import('./quality-library');
    const library = qualityLibrary(() => {});
    await library.preloadAll();
    expect(library.format).toBe('webp');
    expect(library.stats.loaded).toBe(manifest.frames.length);
    expect(fetchPhoto).toHaveBeenCalledTimes(packs.length);
    expect(fetchPhoto.mock.calls.every(([url]) => url.startsWith('/webp-'))).toBe(true);
  } finally { vi.unstubAllGlobals(); vi.resetModules(); }
});
