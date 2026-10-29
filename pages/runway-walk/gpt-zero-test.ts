import GUI from 'lil-gui';
import manifest from './assets/gpt-zero/manifest.json';
import { AtlasPool } from './atlas-pool';
import type { PhotoTransform } from './photo-registration';

type RestoredFrame = { index: number; original: string; edited: string; registration?: PhotoTransform };
const frames: RestoredFrame[] = manifest.frames;
const byIndex = new Map(frames.map(row => [row.index, row]));
const files = import.meta.glob<string>('./assets/gpt-zero/*.{png,webp}', { eager: true, query: '?url', import: 'default' });
const url = (name: string) => files[`./assets/gpt-zero/${name}`];
async function photograph(name: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url(name));
      if (!response.ok) throw new Error(`Restoration photograph unavailable: ${name}`);
      return await response.blob();
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => window.setTimeout(resolve, attempt === 0 ? 250 : 750));
    }
  }
}

/** Full 0° quality experiment. Download first, decode only the current/lookahead
 * window. Generated pixels never inherit the original pose-verification flag. */
export function gptZeroTest(onChange: () => void, faceFront: () => void, onDownloaded: () => void) {
  const options = { enabled: true, still: false, frame: 1, state: `준비 0/${frames.length}장` };
  const blobs = new Map<number, Blob>();
  const edits = new AtlasPool(async index => {
    const blob = blobs.get(index);
    if (!blob) throw new Error('Restoration download is incomplete');
    return createImageBitmap(blob);
  }, 24);
  const originals = new AtlasPool(async index => {
    return createImageBitmap(await photograph(byIndex.get(index)!.original));
  }, 3);
  let download: Promise<void> | undefined;
  let selection = 0;
  let retained: number[] = [];
  const gui = new GUI({ title: '0° GPT 이미지 테스트', width: 270 });
  async function load() {
    if (!download) download = (async () => {
      let cursor = 0, completed = 0;
      await Promise.all(Array.from({ length: 4 }, async () => {
        while (cursor < frames.length) {
          const row = frames[cursor++];
          blobs.set(row.index, await photograph(row.edited));
          onDownloaded();
          options.state = `준비 ${++completed}/${frames.length}장`;
        }
      }));
      options.state = `0° 전체 ${frames.length}/${frames.length}장`;
    })();
    return download;
  }
  const selected = () => frames[options.frame - 1].index;
  async function change() {
    faceFront();
    const version = ++selection;
    try {
      if (options.still) {
        await load();
        const index = selected();
        originals.retain([index]);
        edits.retain([...retained, index]);
        await Promise.all([originals.load(index), edits.load(index)]);
      }
      if (version === selection) onChange();
    } catch { options.state = '비교 사진 로딩 실패'; }
  }
  gui.add(options, 'enabled').name('GPT 보정').onChange(() => { void change(); });
  gui.add(options, 'still').name('프레임 정지 비교').listen().onChange(() => { void change(); });
  gui.add(options, 'frame', 1, frames.length, 1).name('프레임').onChange(() => { options.still = true; void change(); });
  gui.add(options, 'state').name('적용 범위').listen().disable();
  return {
    count: frames.length,
    isStill(yaw: number) { return yaw === 0 && options.still; },
    load,
    async prepare(indices: number[]) {
      if (!options.enabled) return;
      await load();
      await Promise.all([...new Set(indices)].filter(i => byIndex.has(i)).map(i => edits.load(i)));
    },
    retain(indices: number[]) {
      retained = indices.filter(i => byIndex.has(i));
      edits.retain([...retained, ...(options.still ? [selected()] : [])]);
    },
    available(indices: number[]) { return !options.enabled || indices.filter(i => byIndex.has(i)).every(i => !!edits.get(i)); },
    still(yaw: number) {
      if (yaw !== 0 || !options.still) return;
      const index = selected(), image = (options.enabled ? edits : originals).get(index);
      return image ? { index, image, edited: options.enabled } : undefined;
    },
    replacement(yaw: number, index: number) { return yaw === 0 && options.enabled ? edits.get(index) : undefined; },
    registration(index: number) { return byIndex.get(index)?.registration; },
  };
}
