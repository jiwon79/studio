import GUI from 'lil-gui';
import { zeroPoseAsset } from './gpt-zero-pose-patch';
import manifest from './assets/gpt-zero/manifest.json';
import { AtlasPool } from './atlas-pool';
import type { PhotoTransform } from './photo-registration';

type RestoredFrame = { index: number; original: string; edited: string; registration?: PhotoTransform };
const frames: RestoredFrame[] = manifest.frames;
const byIndex = new Map(frames.map(row => [row.index, row]));
const files = import.meta.glob<string>('./assets/{gpt-zero,pose-test}/*.{png,webp}', { eager: true, query: '?url', import: 'default' });
const asset = (index: number, revised: boolean) => zeroPoseAsset(byIndex.get(index)!, revised);
async function photograph(name: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(files[name]);
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
export function gptZeroTest(onChange: () => void, faceFront: () => void, onDownloaded: () => void, onTwelveComparison: (enabled: boolean) => void) {
  const options = { enabled: true, revised: false, compare12: false, still: false, frame: 1, state: `0° 선택 시 ${frames.length}장 준비` };
  let initialComparison = new URLSearchParams(location.search).get('compare') === '12';
  const blobs = new Map<number, Blob>();
  const edits = new AtlasPool(async index => {
    const blob = blobs.get(index);
    if (!blob) throw new Error('Restoration download is incomplete');
    return createImageBitmap(blob);
  }, 24);
  const originals = new AtlasPool(async index => {
    return createImageBitmap(await photograph(`./assets/gpt-zero/${byIndex.get(index)!.original}`));
  }, 3);
  const downloads = new Map<boolean, Promise<void>>(), pending = new Map<number, Promise<void>>();
  let selection = 0;
  let activeEnabled = options.enabled, activeRevised = options.revised;
  let retained: number[] = [];
  const gui = new GUI({ title: '화질 비교', width: 270 });
  async function load() {
    const revised = options.revised;
    let download = downloads.get(revised);
    if (!download) {
      download = (async () => {
        let cursor = 0, completed = 0;
        await Promise.all(Array.from({ length: 4 }, async () => {
          while (cursor < frames.length) {
            const row = asset(frames[cursor++].index, revised);
            if (!blobs.has(row.key)) {
              let job = pending.get(row.key);
              if (!job) {
                job = photograph(row.file).then(blob => { blobs.set(row.key, blob); onDownloaded(); })
                  .finally(() => pending.delete(row.key));
                pending.set(row.key, job);
              }
              await job;
            }
            options.state = `준비 ${++completed}/${frames.length}장`;
          }
        }));
      })().catch(error => { downloads.delete(revised); throw error; });
      downloads.set(revised, download);
    }
    await download;
    if (options.revised === revised) options.state = `0° ${frames.length}장 · 화질만 보정`;
  }
  function protect(indices: number[]) {
    edits.retain(indices.flatMap(index => [asset(index, activeRevised).key, asset(index, options.revised).key]));
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
        protect([...retained, index]);
        await Promise.all([originals.load(index), edits.load(asset(index, options.revised).key)]);
      }
      if (version === selection) onChange();
    } catch { options.state = '비교 사진 로딩 실패'; }
  }
  gui.add(options, 'enabled').name('0° GPT 화질 보정').onChange(() => { void change(); });
  gui.add(options, 'compare12').name('12장만 전후 비교').listen().onChange(() => { if (options.compare12) { faceFront(); gui.close(); } onTwelveComparison(options.compare12); });
  gui.add(options, 'still').name('프레임 정지 비교').listen().onChange(() => { void change(); });
  gui.add(options, 'frame', 1, frames.length, 1).name('프레임').onChange(() => { options.still = true; void change(); });
  gui.add(options, 'state').name('적용 범위').listen().disable();
  for (const controller of gui.controllers.slice(0, 4)) controller.disable();
  return {
    gui,
    setDirection(yaw: number, restored = false) {
      gui.controllers.forEach(controller => controller.show(yaw === 0 && !restored));
      gui.show();
    },
    ready() {
      for (const controller of gui.controllers.slice(0, 4)) controller.enable();
      if (initialComparison) { initialComparison = false; options.compare12 = true; faceFront(); gui.close(); onTwelveComparison(true); }
    },
    pending() { for (const controller of gui.controllers.slice(0, 4)) controller.disable(); },
    count: frames.length,
    endComparison() { options.compare12 = false; gui.open(); },
    get downloaded() { return frames.filter(row => blobs.has(asset(row.index, options.revised).key)).length; },
    activate() { activeEnabled = options.enabled; activeRevised = options.revised; },
    covers(yaw: number, indices: number[], requested = false) { return yaw === 0 && (requested ? options.enabled : activeEnabled) && indices.every(i => byIndex.has(i)); },
    isStill(yaw: number) { return yaw === 0 && options.still; },
    load,
    async prepare(yaw: number, indices: number[], requested = false) {
      if (yaw !== 0 || !(requested ? options.enabled : activeEnabled)) return;
      await load();
      await Promise.all([...new Set(indices)].filter(i => byIndex.has(i)).map(i => edits.load(asset(i, requested ? options.revised : activeRevised).key)));
    },
    retain(indices: number[]) {
      retained = indices.filter(i => byIndex.has(i));
      protect([...retained, ...(options.still ? [selected()] : [])]);
    },
    available(yaw: number, indices: number[]) { return yaw !== 0 || !options.enabled || indices.filter(i => byIndex.has(i)).every(i => !!edits.get(asset(i, options.revised).key)); },
    still(yaw: number) {
      if (yaw !== 0 || !options.still) return;
      const index = selected(), image = options.enabled ? edits.get(asset(index, options.revised).key) : originals.get(index);
      return image ? { index, image, edited: options.enabled } : undefined;
    },
    replacement(yaw: number, index: number) { return yaw === 0 && activeEnabled ? edits.get(asset(index, activeRevised).key) : undefined; },
    registration(index: number, requested = false) { return asset(index, requested ? options.revised : activeRevised).registration; },
    posePatched(yaw: number, index: number, requested = false) { return yaw === 0 && (requested ? options.enabled : activeEnabled) && asset(index, requested ? options.revised : activeRevised).patched; },
  };
}
