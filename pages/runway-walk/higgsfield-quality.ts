import type GUI from 'lil-gui';
import data from './angles.json';
import manifest from './assets/higgsfield-quality-45/manifest.json';
import { directionPhotos } from './direction-photos';
import { AtlasPool } from './atlas-pool';
import { qualityFraming } from './quality-framing';

const files = import.meta.glob<string>('./assets/higgsfield-quality-45/*.webp', { eager: true, query: '?url', import: 'default' });
const byIndex = new Map(manifest.frames.map(row => [row.index, row]));
const complete = manifest.assetVersion === data.assetVersion && directionPhotos(45).every(i => byIndex.has(i));

/** Download the whole selected edit once, then decode a bounded lookahead.
 * Requested and displayed settings stay separate until the renderer hands over
 * a ready sequence at its live clock tick. */
export function higgsfieldQuality45(gui: GUI, onChange: () => void, onDownloaded: () => void) {
  const options = { enabled: complete, state: complete ? `+45° 선택 시 ${byIndex.size}장 준비` : '전체 사진 준비 전' };
  let activeEnabled = options.enabled;
  const blobs = new Map<number, Blob>();
  const images = new AtlasPool(async index => {
    const blob = blobs.get(index);
    if (!blob) throw new Error('Higgsfield download incomplete');
    return createImageBitmap(blob, { resizeWidth: 768, resizeHeight: 1152, resizeQuality: 'high' });
  }, 24);
  let download: Promise<void> | undefined;
  const folder = gui.addFolder('+45° Higgsfield');
  const control = folder.add(options, 'enabled').name('화질 보정 ON/OFF').onChange(onChange);
  if (!complete) control.disable();
  folder.add(options, 'state').name('준비 상태').listen().disable();
  async function photograph(index: number) {
    const row = byIndex.get(index)!;
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch(files[`./assets/higgsfield-quality-45/${row.edited}`]);
        if (!response.ok) throw new Error(`Higgsfield photo unavailable: ${index}`);
        blobs.set(index, await response.blob());
        options.state = `준비 ${blobs.size}/${byIndex.size}장`;
        onDownloaded();
        return;
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise(resolve => window.setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }
  async function load() {
    if (!complete) throw new Error('Incomplete Higgsfield direction');
    if (!download) {
      const pending = [...byIndex.keys()].filter(index => !blobs.has(index));
      let cursor = 0;
      download = Promise.all(Array.from({ length: 6 }, async () => {
        while (cursor < pending.length) await photograph(pending[cursor++]);
      })).then(() => { options.state = `+45° · ${byIndex.size}장 · 화질만 보정`; })
        .catch(error => { download = undefined; throw error; });
    }
    await download;
  }
  const enabled = (requested: boolean) => requested ? options.enabled : activeEnabled;
  return {
    setDirection(yaw: number) { folder.show(yaw === 45); },
    count: byIndex.size,
    get downloaded() { return blobs.size; },
    get decoded() { return images.size; },
    load,
    activate() { activeEnabled = options.enabled; },
    covers(yaw: number, indices: number[], requested = false) {
      return complete && yaw === 45 && enabled(requested) && indices.every(index => byIndex.has(index));
    },
    async prepare(yaw: number, indices: number[], requested = false) {
      if (yaw !== 45 || !enabled(requested)) return;
      await load();
      await Promise.all([...new Set(indices)].map(index => images.load(index)));
    },
    retain(indices: number[]) { images.retain(indices.filter(index => byIndex.has(index))); },
    available(yaw: number, indices: number[]) {
      return yaw !== 45 || !options.enabled || indices.every(index => !!images.get(index));
    },
    replacement(yaw: number, index: number) { return yaw === 45 && activeEnabled ? images.get(index) : undefined; },
    registration(index: number) {
      const row = byIndex.get(index);
      return row ? qualityFraming(row.qualityRegistration) : undefined;
    },
  };
}
