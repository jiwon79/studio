import data from './assets/pose-test/manifest.json';
import depth from './assets/pose-depth-v3/manifest.json';
import { fitPoseSequence } from './pose-sequence-registration';
import { lowerBodyShape } from './lower-body-diagnostics';
import { zeroPoseFits } from './gpt-zero-pose-patch';
import { applyPhotoTransform } from './photo-registration';
import './zero-twelve-comparison.css';

const files = import.meta.glob<string>('./assets/{gpt-zero,pose-test,pose-depth-v3}/*.{png,webp,jpg}', { eager: true, query: '?url', import: 'default' });
export const zeroTwelveFrames = data.frames.map((row, i) => ({
  index: row.index,
  phase: row.phase,
  model: `./assets/pose-test/${row.model}`,
  before: `./assets/gpt-zero/${row.baseline}`,
  after: `./assets/pose-test/${row.headBody}`,
  beforeTransforms: [row.oldCut, row.oldRegistration],
  afterTransforms: [zeroPoseFits[i]],
}));

const depthTargets = data.frames.map(row => row.target.map((p, j) => j === 2 ? row.headTarget.leftEye : j === 5 ? row.headTarget.rightEye : p));
const depthFits = fitPoseSequence(depth.frames.map(row => row.points), depthTargets);
export const depthTwelveFrames = zeroTwelveFrames.map((row, i) => ({ ...row,
  before: `./assets/pose-test/${data.frames[i].headBody}`,
  after: `./assets/pose-depth-v3/${depth.frames[i].file}`,
  beforeTransforms: [zeroPoseFits[i]], afterTransforms: [depthFits[i]],
}));

/** The exact first twelve artwork slots, not an invented closed gait loop.
 * All three views share one transport and wait for all 36 decoded images. */
export function zeroTwelveComparison(onClose: () => void) {
  const root = document.createElement('section');
  root.id = 'zero-twelve'; root.hidden = true;
  root.setAttribute('aria-label', '0도 12장 보정 전후 애니메이션 비교');
  root.innerHTML = `<header><strong>0° · 12장 전후 비교</strong><button data-close>작품으로</button></header>
    <div class="pair"><figure><figcaption data-before-label>보정 전</figcaption><canvas width="768" height="1152" data-before></canvas></figure><figure><figcaption>3D 인체 모델</figcaption><canvas width="768" height="1152" data-model></canvas></figure><figure><figcaption data-after-label>보정 후</figcaption><canvas width="768" height="1152" data-after></canvas></figure></div>
    <footer><div class="variant"><label>시험 버전 <select data-variant><option value="previous">기존 보정</option><option value="depth">깊이·무릎 가이드 시험</option></select></label><button data-guide hidden>깊이 가이드</button></div><p data-audit hidden></p><div class="transport"><button data-play disabled>다시 재생</button><label>속도 <select data-speed><option value="1">1×</option><option value="0.5" selected>0.5×</option><option value="0.25">0.25×</option></select></label><output data-frame>1 / 12</output></div><input data-seek type="range" aria-label="비교 프레임" min="1" max="12" value="1" disabled><p data-status role="status">36장 준비 중…</p></footer><div class="guide-panel" data-guide-panel hidden><button data-guide-close>가이드 닫기</button><a data-guide-link target="_blank" rel="noopener">크게 보기</a><img data-guide-image alt="같은 3D 모델 시점의 정면·깊이·표면 방향·측면 가이드"></div>`;
  document.body.append(root);
  const find = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const playButton = find<HTMLButtonElement>('[data-play]'), slider = find<HTMLInputElement>('[data-seek]');
  const speed = find<HTMLSelectElement>('[data-speed]'), state = find('[data-status]');
  const canvases = [find<HTMLCanvasElement>('[data-before]'), find<HTMLCanvasElement>('[data-model]'), find<HTMLCanvasElement>('[data-after]')];
  let depthMode = new URLSearchParams(location.search).get('depth') === '1';
  const variant = find<HTMLSelectElement>('[data-variant]'); variant.value = depthMode ? 'depth' : 'previous';
  const pictures = new Map<string, ImageBitmap>();
  let active = false, ready = false, playing = false, tick = 0, epoch = 0, transport = 0;
  let abort: AbortController | undefined;
  function pause() { playing = false; transport++; playButton.textContent = '다시 재생'; }
  function draw() {
    if (!ready || !active) return;
    const row = (depthMode ? depthTwelveFrames : zeroTwelveFrames)[tick];
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
    if (depthMode) {
      const target = lowerBodyShape(data.frames[tick].target, 'right'), before = lowerBodyShape(data.frames[tick].headBodyPoints, 'right'), after = lowerBodyShape(depth.frames[tick].points, 'right');
      const n = (v: number | undefined) => v === undefined ? '—' : v.toFixed(2);
      const model = depth.frames[tick];
      find('[data-audit]').textContent = `미검증 시험본 · 모델과 발 높이·접힘 차이가 남아 있습니다. 오른쪽 종아리/허벅지 비율(2D): 모델 ${n(target.calfToThigh)} · 기존 ${n(before.calfToThigh)} · 새 ${n(after.calfToThigh)}. 발길이/종아리(2D): 모델 ${n(target.footToCalf)} · 기존 ${n(before.footToCalf)} · 새 ${n(after.footToCalf)}. 새 하체 최소 관절 신뢰 ${after.confidence.toFixed(2)}. 모델 3D 무릎 굽힘 ${model.feet3D.r.kneeFlexionDegrees.toFixed(1)}°, 오른발 앞뒤 차이 ${(model.rightMinusLeftDepth * 100).toFixed(0)}cm(음수=뒤). 사진의 깊이를 검증한 수치가 아닙니다.`;
      const file = files[`./assets/pose-depth-v3/${model.guide}`];
      find<HTMLAnchorElement>('[data-guide-link]').href = file;
      if (!find('[data-guide-panel]').hidden) find<HTMLImageElement>('[data-guide-image]').src = file;
    }

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
  variant.onchange = () => { depthMode = variant.value === 'depth'; setEnabled(true); };
  find<HTMLButtonElement>('[data-guide]').onclick = () => { pause(); find('[data-guide-panel]').hidden = false; draw(); };
  find<HTMLButtonElement>('[data-guide-close]').onclick = () => { find('[data-guide-panel]').hidden = true; };
  playButton.onclick = play;
  slider.oninput = () => { pause(); tick = Number(slider.value) - 1; draw(); state.textContent = '프레임 비교 · 다시 재생하면 1번부터 시작합니다.'; };
  find<HTMLButtonElement>('[data-close]').onclick = () => { setEnabled(false); onClose(); };
  root.onkeydown = event => { if (event.key === 'Escape') { setEnabled(false); onClose(); } };
  function setEnabled(enabled: boolean) {
    active = enabled; root.hidden = !enabled; root.dataset.ready = 'false';
    document.querySelector<HTMLElement>('#surface')!.inert = enabled;
    pause(); ready = false; epoch++; abort?.abort(); pictures.forEach(image => image.close()); pictures.clear();
    find('[data-guide-panel]').hidden = true;
    if (!enabled) return;
    const url = new URL(location.href);
    if (depthMode) url.searchParams.set('depth', '1'); else url.searchParams.delete('depth');
    history.replaceState(null, '', url);
    find('[data-before-label]').textContent = depthMode ? '이전 보정' : '보정 전';
    find('[data-after-label]').textContent = depthMode ? '깊이·무릎 시험본' : '보정 후';
    find('[data-guide]').hidden = !depthMode; find('[data-audit]').hidden = !depthMode;
    canvases.forEach(canvas => canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height));
    slider.value = '1'; find<HTMLOutputElement>('[data-frame]').value = '1 / 12';
    const version = epoch, controller = new AbortController(); abort = controller;
    tick = 0; playButton.disabled = true; slider.disabled = true; state.textContent = '36장 준비 중…';
    const wanted = [...new Set((depthMode ? depthTwelveFrames : zeroTwelveFrames).flatMap(row => [row.before, row.model, row.after]))];
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
