import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
import type { PhotoPack, PhotoPackLibraries } from '../../pages/runway-walk/photo-packs';

export const PHOTOS_PER_PACK = 64;
type Frame = { index: number; file: string; sha256: string; fallbackSha256?: string };
type Manifest = { assetVersion: string; frames: Frame[] };

/** Emit alternate, content-addressed downloads. Only one format is fetched. */
export function runwayQualityPacks(root: string): Plugin {
  let emitted: { name: string; bytes: Buffer }[] = [];
  return {
    name: 'runway-quality-packs',
    async config(_config, environment) {
      if (environment.isPreview) return;
      const assets = resolve(root, 'pages/runway-walk/assets');
      const original: Manifest = JSON.parse(await readFile(resolve(assets, 'quality/manifest.json'), 'utf8'));
      const alternative: Manifest = JSON.parse(await readFile(resolve(assets, 'quality-avif/manifest.json'), 'utf8'));
      const before: Manifest = JSON.parse(await readFile(resolve(assets, 'quality-original/manifest.json'), 'utf8'));
      const byIndex = new Map(original.frames.map(row => [row.index, row]));
      if (alternative.assetVersion !== original.assetVersion || alternative.frames.length !== original.frames.length
        || new Set(alternative.frames.map(row => row.index)).size !== byIndex.size
        || alternative.frames.some(row => row.fallbackSha256 !== byIndex.get(row.index)?.sha256)) {
        throw new Error('AVIF derivatives do not match the final WebP edit');
      }
      if (before.assetVersion !== original.assetVersion || before.frames.length !== original.frames.length
        || new Set(before.frames.map(row => row.index)).size !== byIndex.size
        || before.frames.some(row => !byIndex.has(row.index))) throw new Error('Original photographs do not match the final edit');
      emitted = [];
      const libraries: PhotoPackLibraries = { webp: [], avif: [], original: [] };
      for (const format of ['webp', 'avif', 'original'] as const) {
        const manifest = format === 'original' ? before : format === 'webp' ? original : alternative;
        const folder = resolve(assets, format === 'original' ? 'quality-original' : format === 'webp' ? 'quality' : 'quality-avif');
        const perPack = format === 'original' ? 16 : PHOTOS_PER_PACK;
        for (let start = 0; start < manifest.frames.length; start += perPack) {
          const entries: PhotoPack['entries'] = [], chunks: Buffer[] = [];
          let length = 0;
          for (const row of manifest.frames.slice(start, start + perPack)) {
            const bytes = await readFile(resolve(folder, row.file));
            if (createHash('sha256').update(bytes).digest('hex') !== row.sha256) throw new Error(`Unexpected ${format} photo: ${row.index}`);
            entries.push({ index: row.index, offset: length, length: bytes.length });
            chunks.push(bytes); length += bytes.length;
          }
          const bytes = Buffer.concat(chunks), hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
          const prefix = format === 'original' ? 'runway-original' : format === 'webp' ? 'runway-photos' : 'runway-avif';
          const name = `${prefix}-${String(libraries[format].length).padStart(2, '0')}-${hash}.bin`;
          libraries[format].push({ url: `/assets/${name}`, length, mime: format === 'avif' ? 'image/avif' : 'image/webp', entries });
          emitted.push({ name, bytes });
        }
      }
      return { define: { __RUNWAY_PHOTO_PACKS__: JSON.stringify(libraries) } };
    },
    buildStart() {
      for (const asset of emitted) this.emitFile({ type: 'asset', fileName: `assets/${asset.name}`, source: asset.bytes });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const asset = emitted.find(asset => request.url?.split('?')[0] === `/assets/${asset.name}`);
        if (!asset) { next(); return; }
        response.setHeader('Content-Type', 'application/octet-stream');
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        response.setHeader('Content-Length', asset.bytes.length);
        response.end(request.method === 'HEAD' ? undefined : asset.bytes);
      });
    },
  };
}
