import data from './angles.json';
import manifest from './assets/quality/manifest.json';
import { directionPhotos } from './direction-photos';
import { AtlasPool } from './atlas-pool';
import { PhotoDownloads } from './photo-downloads';
import { qualityFraming } from './quality-framing';
import { unpackPhotographs, type PhotoPack } from './photo-packs';

declare const __RUNWAY_PHOTO_PACKS__: PhotoPack[];

const packs = __RUNWAY_PHOTO_PACKS__;
const byIndex = new Map(manifest.frames.map(row => [row.index, row]));
if (manifest.assetVersion !== data.assetVersion) throw new Error('Photographs do not match the walk library');
for (let yaw = -90; yaw <= 90; yaw += 5) {
  if (directionPhotos(yaw).some(index => !byIndex.has(index))) throw new Error(`Missing photograph at ${yaw}°`);
}

/** Download the complete final edit once; decode only the live playback window. */
export function qualityLibrary(onDownloaded: () => void) {
  const photos = new Map<number, Blob>();
  let receivedBytes = 0;
  const entries = packs.flatMap(pack => pack.entries.map(entry => entry.index));
  if (new Set(entries).size !== byIndex.size || entries.length !== byIndex.size || entries.some(index => !byIndex.has(index))) {
    throw new Error('Photograph packs do not match the final edit');
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
        return blob;
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise(resolve => window.setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }, onDownloaded, 6);
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
    async preloadAll() { await Promise.all(packs.map((_, index) => downloads.request(index, () => true, false))); },
    async prepare(indices: number[]) { await Promise.all([...new Set(indices)].map(index => images.load(index))); },
    retain(indices: number[]) { images.retain(indices); },
    available(indices: number[]) { return indices.every(index => !!images.get(index)); },
    image(index: number) { return images.get(index); },
    registration(index: number) { return qualityFraming(byIndex.get(index)!.registration); },
    provider(index: number) { return byIndex.get(index)!.provider; },
  };
}
