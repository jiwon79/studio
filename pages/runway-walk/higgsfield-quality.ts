import type GUI from 'lil-gui';
import data from './angles.json';
import initialManifest from './assets/higgsfield-quality-45/manifest.json';
import addedManifest from './assets/higgsfield-quality/manifest.json';
import builtInManifest from './assets/gpt-quality/manifest.json';
import { directionPhotos } from './direction-photos';
import { AtlasPool } from './atlas-pool';
import { PhotoDownloads } from './photo-downloads';
import { qualityFraming } from './quality-framing';

type QualityFrame = { index: number; edited: string; playback?: string; qualityRegistration: { scale: number; dx: number; dy: number } };
type QualityLibrary = { assetVersion: string; frames: QualityFrame[] };
const files = import.meta.glob<string>('./assets/{higgsfield-quality,higgsfield-quality-45,gpt-quality}/*.webp', { eager: true, query: '?url', import: 'default' });
const byIndex = new Map<number, QualityFrame & { folder: string }>();
for (const [folder, library] of [['higgsfield-quality-45', initialManifest], ['higgsfield-quality', addedManifest], ['gpt-quality', builtInManifest]] as [string, QualityLibrary][]) {
  if (library.assetVersion !== data.assetVersion) continue;
  for (const row of library.frames) byIndex.set(row.index, { ...row, folder });
}
const completeDirections = new Set(Array.from({ length: 37 }, (_, i) => i * 5 - 90).filter(yaw => directionPhotos(yaw).every(i => byIndex.has(i))));
const activeIndices = [...new Set([...completeDirections].flatMap(directionPhotos))];

/** All requested angles share a comparison switch. A direction is promoted
 * only when every scheduled source photograph has a matching restoration. */
export function higgsfieldQuality(gui: GUI, onChange: () => void, onDownloaded: () => void) {
  let selectedYaw = 0;
  const options = { enabled: true, state: '' };
  let activeEnabled = options.enabled;
  const blobs = new Map<number, Blob>();
  const images = new AtlasPool(async index => {
    const blob = blobs.get(index);
    if (!blob) throw new Error('Higgsfield download incomplete');
    return createImageBitmap(blob);
  }, 24);
  const folder = gui.addFolder('사진 화질');
  folder.add(options, 'enabled').name('화질 보정 ON/OFF').onChange(onChange);
  folder.add(options, 'state').name('준비 상태').listen().disable();
  const downloads = new PhotoDownloads(async index => {
    const row = byIndex.get(index)!;
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch(files[`./assets/${row.folder}/${row.playback ?? row.edited}`]);
        if (!response.ok) throw new Error(`Higgsfield photo unavailable: ${index}`);
        const blob = await response.blob();
        blobs.set(index, blob);
        return blob;
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise(resolve => window.setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }, () => { state(); onDownloaded(); }, 6);
  function state() {
    const indices = directionPhotos(selectedYaw), count = indices.filter(i => blobs.has(i)).length;
    options.state = !completeDirections.has(selectedYaw) ? `${selectedYaw}° · 보정 사진 준비 중` : count === indices.length
      ? `${selectedYaw}° · ${count}장 · 화질만 보정` : `${selectedYaw}° · 준비 ${count}/${indices.length}장`;
  }
  async function load(yaw = selectedYaw) {
    if (!completeDirections.has(yaw)) return;
    await Promise.all(directionPhotos(yaw).map(index => downloads.request(index, () => selectedYaw === yaw)));
  }
  const enabled = (requested: boolean) => requested ? options.enabled : activeEnabled;
  return {
    provider(index: number) { return byIndex.get(index)?.folder === 'gpt-quality' ? 'built-in-gpt' : 'higgsfield'; },
    hasDirection(yaw: number) { return completeDirections.has(yaw); },
    setDirection(yaw: number) { selectedYaw = yaw; state(); },
    get count() { return directionPhotos(selectedYaw).length; },
    get downloaded() { return directionPhotos(selectedYaw).filter(i => blobs.has(i)).length; },
    get decoded() { return images.size; },
    get preloadStats() {
      return { total: activeIndices.length, loaded: activeIndices.filter(i => blobs.has(i)).length,
        bytes: activeIndices.reduce((sum, i) => sum + (blobs.get(i)?.size ?? 0), 0) };
    },
    async preloadAll() { await Promise.all(activeIndices.map(index => downloads.request(index, () => true, false))); },
    load,
    activate() { activeEnabled = options.enabled; },
    covers(yaw: number, indices: number[], requested = false) {
      return completeDirections.has(yaw) && enabled(requested) && indices.every(index => byIndex.has(index));
    },
    async prepare(yaw: number, indices: number[], requested = false) {
      if (!completeDirections.has(yaw) || !enabled(requested)) return;
      await load(yaw);
      await Promise.all([...new Set(indices)].map(index => images.load(index)));
    },
    retain(indices: number[]) { images.retain(indices.filter(index => byIndex.has(index))); },
    available(yaw: number, indices: number[]) {
      return !completeDirections.has(yaw) || !options.enabled || indices.every(index => !!images.get(index));
    },
    replacement(yaw: number, index: number) { return completeDirections.has(yaw) && activeEnabled ? images.get(index) : undefined; },
    registration(index: number) {
      const row = byIndex.get(index);
      return row ? qualityFraming(row.qualityRegistration) : undefined;
    },
  };
}
