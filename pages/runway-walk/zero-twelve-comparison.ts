import data from './assets/pose-test/manifest.json';
import { zeroPoseFits } from './gpt-zero-pose-patch';
import { applyPhotoTransform } from './photo-registration';
import './zero-twelve-comparison.css';

const files = import.meta.glob<string>('./assets/{gpt-zero,pose-test}/*.{png,webp}', { eager: true, query: '?url', import: 'default' });
export const zeroTwelveFrames = data.frames.map((row, i) => ({
  index: row.index,
  phase: row.phase,
  model: `./assets/pose-test/${row.model}`,
  before: `./assets/gpt-zero/${row.baseline}`,
  after: `./assets/pose-test/${row.headBody}`,
  beforeTransforms: [row.oldCut, row.oldRegistration],
  afterTransforms: [zeroPoseFits[i]],
}));

/** The exact first twelve artwork slots, not an invented closed gait loop.
 * All three views share one transport and wait for all 36 decoded images. */
export function zeroTwelveComparison(onClose: () => void) {
  const root = document.createElement('section');
  root.id = 'zero-twelve'; root.hidden = true;
  root.setAttribute('aria-label', '0도 12장 보정 전후 애니메이션 비교');
  root.innerHTML = `<header><strong>0° · 12장 전후 비교</strong><button data-close>작품으로</button></header>
    <div class="pair"><figure><figcaption>보정 전</figcaption><canvas width="768" height="1152" data-before></canvas></figure><figure><figcaption>3D 인체 모델</figcaption><canvas width="768" height="1152" data-model></canvas></figure><figure><figcaption>보정 후</figcaption><canvas width="768" height="1152" data-after></canvas></figure></div>
    <footer><div class="transport"><button data-play disabled>다시 재생</button><label>속도 <select data-speed><option value="1">1×</option><option value="0.5" selected>0.5×</option><option value="0.25">0.25×</option></select></label><output data-frame>1 / 12</output></div><input data-seek type="range" aria-label="비교 프레임" min="1" max="12" value="1" disabled><p data-status role="status">36장 준비 중…</p></footer>`;
  document.body.append(root);
  const find = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const playButton = find<HTMLButtonElement>('[data-play]'), slider = find<HTMLInputElement>('[data-seek]');
  const speed = find<HTMLSelectElement>('[data-speed]'), state = find('[data-status]');
  const canvases = [find<HTMLCanvasElement>('[data-before]'), find<HTMLCanvasElement>('[data-model]'), find<HTMLCanvasElement>('[data-after]')];
  const pictures = new Map<string, ImageBitmap>();
  let active = false, ready = false, playing = false, tick = 0, epoch = 0, transport = 0;
  let abort: AbortController | undefined;
  function pause() { playing = false; transport++; playButton.textContent = '다시 재생'; }
  function draw() {
    if (!ready || !active) return;
    const row = zeroTwelveFrames[tick];
    const assets = [row.before, row.model, row.after], transforms = [row.beforeTransforms, [], row.afterTransforms];
    canvases.forEach((canvas, i) => {
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(1.5, 0, 0, 1.5, 0, 0); ctx.clearRect(0, 0, 512, 768); ctx.save();
      for (const transform of transforms[i]) applyPhotoTransform(ctx, transform);
      const image = pictures.get(assets[i])!;
      ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, 512, 768); ctx.restore();
      canvas.dataset.tick = String(tick); canvas.dataset.index = String(row.index); canvas.dataset.phase = String(row.phase);
    });
    slider.value = String(tick + 1); find<HTMLOutputElement>('[data-frame]').value = `${tick + 1} / 12`;
    root.dataset.tick = String(tick);
  }
  function play() {
    if (!ready || !active) return;
    if (playing) { pause(); state.textContent = '일시정지'; return; }
    tick = 0; draw(); playing = true; const run = ++transport;
    let last = performance.now(), carry = 0;
    playButton.textContent = '일시정지'; state.textContent = '같은 12장을 같은 시점으로 재생 중';
    const animate = (now: number) => {
      if (!active || !playing || run !== transport) return;
      carry += Math.min(now - last, 200); last = now;
      const step = 1000 / data.fps / Number(speed.value);
      while (carry >= step) {
        carry -= step;
        if (tick === zeroTwelveFrames.length - 1) {
          pause(); state.textContent = '12장 재생 완료 · 부분 보행 구간이므로 끝에서 멈춥니다.'; return;
        }
        tick++; draw();
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
  playButton.onclick = play;
  slider.oninput = () => { pause(); tick = Number(slider.value) - 1; draw(); state.textContent = '프레임 비교 · 다시 재생하면 1번부터 시작합니다.'; };
  find<HTMLButtonElement>('[data-close]').onclick = () => { setEnabled(false); onClose(); };
  root.onkeydown = event => { if (event.key === 'Escape') { setEnabled(false); onClose(); } };
  function setEnabled(enabled: boolean) {
    active = enabled; root.hidden = !enabled; root.dataset.ready = 'false';
    document.querySelector<HTMLElement>('#surface')!.inert = enabled;
    pause(); ready = false; epoch++; abort?.abort(); pictures.forEach(image => image.close()); pictures.clear();
    if (!enabled) return;
    const version = epoch, controller = new AbortController(); abort = controller;
    tick = 0; playButton.disabled = true; slider.disabled = true; state.textContent = '36장 준비 중…';
    const wanted = [...new Set(zeroTwelveFrames.flatMap(row => [row.before, row.model, row.after]))];
    let next = 0, loaded = 0;
    void Promise.all(Array.from({ length: 4 }, async () => {
      while (next < wanted.length && active && version === epoch) {
        const file = wanted[next++], response = await fetch(files[file], { signal: controller.signal });
        if (!response.ok) throw Error('비교 사진을 불러오지 못했어요.');
        const image = await createImageBitmap(await response.blob());
        if (version !== epoch || !active) { image.close(); return; }
        pictures.set(file, image); state.textContent = `비교 사진 ${++loaded}/${wanted.length}장 준비 중…`;
      }
    })).then(() => {
      if (!active || version !== epoch) return;
      ready = true; root.dataset.ready = 'true'; playButton.disabled = false; slider.disabled = false;
      draw(); playButton.focus(); play();
    }).catch(error => {
      if (version === epoch && active) { controller.abort(); state.textContent = error instanceof Error ? error.message : '비교 사진 로딩 실패'; }
    });
  }
  return { setEnabled, get active() { return active; } };
}
