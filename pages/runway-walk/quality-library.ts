import data from './angles.json';
import manifest from './assets/quality/manifest.json';
import { directionPhotos } from './direction-photos';
import { AtlasPool } from './atlas-pool';
import { PhotoDownloads } from './photo-downloads';
import { qualityFraming } from './quality-framing';

const files = import.meta.glob<string>('./assets/quality/*.webp', { eager: true, query: '?url', import: 'default' });
const byIndex = new Map(manifest.frames.map(row => [row.index, row]));
if (manifest.assetVersion !== data.assetVersion) throw new Error('Photographs do not match the walk library');
for (let yaw = -90; yaw <= 90; yaw += 5) {
  if (directionPhotos(yaw).some(index => !byIndex.has(index))) throw new Error(`Missing photograph at ${yaw}°`);
}

/** Download the complete final edit once; decode only the live playback window. */
export function qualityLibrary(onDownloaded: () => void) {
  const downloads = new PhotoDownloads(async index => {
    const row = byIndex.get(index);
    if (!row) throw new Error(`Photograph is outside the final edit: ${index}`);
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch(files[`./assets/quality/${row.file}`]);
        if (!response.ok) throw new Error(`Photograph unavailable: ${index}`);
        return await response.blob();
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise(resolve => window.setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }, onDownloaded, 6);
  const images = new AtlasPool(async index => {
    const blob = downloads.get(index);
    if (!blob) throw new Error(`Photograph download incomplete: ${index}`);
    return createImageBitmap(blob);
  }, 24);
  return {
    get stats() {
      return { loaded: downloads.size, total: byIndex.size,
        bytes: manifest.frames.reduce((sum, row) => sum + (downloads.get(row.index)?.size ?? 0), 0) };
    },
    get decoded() { return images.size; },
    async preloadAll() { await Promise.all(manifest.frames.map(row => downloads.request(row.index, () => true, false))); },
    async prepare(indices: number[]) { await Promise.all([...new Set(indices)].map(index => images.load(index))); },
    retain(indices: number[]) { images.retain(indices); },
    available(indices: number[]) { return indices.every(index => !!images.get(index)); },
    image(index: number) { return images.get(index); },
    registration(index: number) { return qualityFraming(byIndex.get(index)!.registration); },
    provider(index: number) { return byIndex.get(index)!.provider; },
  };
}
