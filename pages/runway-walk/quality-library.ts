import data from './angles.json';
import manifest from './assets/quality/manifest.json';
import { directionPhotos } from './direction-photos';
import { AtlasPool } from './atlas-pool';
import { PhotoDownloads } from './photo-downloads';
import { qualityFraming } from './quality-framing';
import { unpackPhotographs, type PhotoPackLibraries } from './photo-packs';
import { IDENTITY_PHOTO } from './photo-registration';
import { supportsAvif } from './image-format';

declare const __RUNWAY_PHOTO_PACKS__: PhotoPackLibraries;

const libraries = __RUNWAY_PHOTO_PACKS__;
const byIndex = new Map(manifest.frames.map(row => [row.index, row]));
if (manifest.assetVersion !== data.assetVersion) throw new Error('Photographs do not match the walk library');
for (let yaw = -90; yaw <= 90; yaw += 5) {
  if (directionPhotos(yaw).some(index => !byIndex.has(index))) throw new Error(`Missing photograph at ${yaw}°`);
}

/** Cache enhanced photos globally and originals per direction; decode the live window. */
export function qualityLibrary(onDownloaded: () => void, variant: 'enhanced' | 'original' = 'enhanced') {
  const photos = new Map<number, Blob>();
  let receivedBytes = 0;
  let format: 'webp' | 'avif' = 'webp';
  let packs = variant === 'original' ? libraries.original : libraries.webp;
  for (const collection of (variant === 'original' ? [libraries.original] : [libraries.webp, libraries.avif])) {
    const entries = collection.flatMap(pack => pack.entries.map(entry => entry.index));
    if (new Set(entries).size !== byIndex.size || entries.length !== byIndex.size || entries.some(index => !byIndex.has(index))) {
      throw new Error('Photograph packs do not match the final edit');
    }
  }
  const packForPhoto = new Map(packs.flatMap((pack, index) => pack.entries.map(row => [row.index, index] as const)));
  const originalCache = new Map<number, number>();
  let viewPacks = new Set<number>(), retainedPacks = new Set<number>();
  function touch(index: number) {
    const size = originalCache.get(index);
    if (size !== undefined) { originalCache.delete(index); originalCache.set(index, size); }
  }
  function trimOriginals() {
    if (variant !== 'original') return;
    let bytes = [...originalCache.values()].reduce((sum, size) => sum + size, 0);
    for (const [index, size] of originalCache) {
      if (bytes <= 64 * 1024 ** 2) break;
      if (viewPacks.has(index) || retainedPacks.has(index)) continue;
      for (const entry of packs[index].entries) photos.delete(entry.index);
      originalCache.delete(index); downloads.forget(index); bytes -= size;
    }
  }
  const downloads = new PhotoDownloads(async index => {
    const pack = packs[index];
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch(pack.url);
        if (!response.ok) throw new Error(`Photograph pack unavailable: ${index}`);
        const blob = await response.blob();
        const unpacked = unpackPhotographs(pack, blob);
        for (const [index, photo] of unpacked) photos.set(index, photo);
        receivedBytes += blob.size;
        if (variant === 'original') originalCache.set(index, blob.size);
        return blob;
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise(resolve => window.setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }, () => { trimOriginals(); onDownloaded(); }, 6);
  const images = new AtlasPool(async index => {
    const blob = photos.get(index);
    if (!blob) throw new Error(`Photograph download incomplete: ${index}`);
    return createImageBitmap(blob);
  }, 24);
  return {
    get stats() {
      return { loaded: photos.size, total: byIndex.size, bytes: receivedBytes };
    },
    get decoded() { return images.size; },
    get format() { return format; },
    async preloadAll(current: () => boolean = () => true) {
      format = variant === 'enhanced' && await supportsAvif() ? 'avif' : 'webp';
      packs = variant === 'original' ? libraries.original : libraries[format];
      await Promise.all(packs.map((_, index) => downloads.request(index, current, false)));
    },
    statsFor(indices: number[]) { return { loaded: indices.filter(index => photos.has(index)).length, total: indices.length }; },
    async preloadDirection(yaw: number, current: () => boolean) {
      if (variant !== 'original') return;
      viewPacks = new Set(directionPhotos(yaw).map(index => packForPhoto.get(index)!));
      await Promise.all([...viewPacks].map(index => { touch(index); return downloads.request(index, current); }));
      trimOriginals();
    },
    async prepare(indices: number[]) {
      if (variant === 'original') {
        await Promise.all([...new Set(indices.map(index => packForPhoto.get(index)!))].map(index => { touch(index); return downloads.request(index); }));
      }
      await Promise.all([...new Set(indices)].map(index => images.load(index)));
    },
    retain(indices: number[]) {
      images.retain(indices);
      retainedPacks = new Set(indices.map(index => packForPhoto.get(index)!));
      trimOriginals();
    },
    available(indices: number[]) { return indices.every(index => !!images.get(index)); },
    image(index: number) { return images.get(index); },
    registration(index: number) { return variant === 'original' ? IDENTITY_PHOTO : qualityFraming(byIndex.get(index)!.registration); },
    provider(index: number) { return variant === 'original' ? 'original' : byIndex.get(index)!.provider; },
  };
}
