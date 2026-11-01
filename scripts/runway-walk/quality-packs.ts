import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
import type { PhotoPack } from '../../pages/runway-walk/photo-packs';

export const PHOTOS_PER_PACK = 64;

/** Concatenation preserves every encoded pixel; individual WebPs remain the
 * editable source. Only these content-addressed packs are shipped to browsers. */
export function runwayQualityPacks(root: string): Plugin {
  let emitted: { name: string; bytes: Buffer }[] = [];
  return {
    name: 'runway-quality-packs',
    async config(_config, environment) {
      if (environment.isPreview) return;
      const folder = resolve(root, 'pages/runway-walk/assets/quality');
      const manifest = JSON.parse(await readFile(resolve(folder, 'manifest.json'), 'utf8')) as {
        frames: { index: number; file: string; sha256: string }[];
      };
      emitted = [];
      const packs: PhotoPack[] = [];
      for (let start = 0; start < manifest.frames.length; start += PHOTOS_PER_PACK) {
        const entries: PhotoPack['entries'] = [], chunks: Buffer[] = [];
        let length = 0;
        for (const row of manifest.frames.slice(start, start + PHOTOS_PER_PACK)) {
          const bytes = await readFile(resolve(folder, row.file));
          if (createHash('sha256').update(bytes).digest('hex') !== row.sha256) throw new Error(`Unexpected photo: ${row.index}`);
          entries.push({ index: row.index, offset: length, length: bytes.length });
          chunks.push(bytes); length += bytes.length;
        }
        const bytes = Buffer.concat(chunks), hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
        const name = `runway-photos-${String(packs.length).padStart(2, '0')}-${hash}.bin`;
        packs.push({ url: `/assets/${name}`, length, entries });
        emitted.push({ name, bytes });
      }
      return { define: { __RUNWAY_PHOTO_PACKS__: JSON.stringify(packs) } };
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
