import GUI from 'lil-gui';
import data from './assets/pose-test/manifest.json';
import { applyPhotoTransform, transformPhotoPoint, IDENTITY_PHOTO } from './photo-registration';
import { fitPosePhoto, alignedPose, footRms, footMotionRms, footConfidence, feet, type PosePoints } from './pose-test-metrics';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const frames = data.frames;
const files = import.meta.glob<string>('./assets/{gpt-zero,pose-test}/*.{webp,png}', { eager: true, query: '?url', import: 'default' });
const url = (group: string, name: string) => files[`./assets/${group}/${name}`];
const bitmaps = new Map<string, ImageBitmap>();
const options = { frame: 1, method: '3D 모델 우선', align: true, joints: true, speed: .5, play: () => play() };
const gui = new GUI({ container: $('controls'), title: '0° 비교 옵션', width: 440 });
let ready = false, playing = false, transport = 0;
const frameControl = gui.add(options, 'frame', 1, frames.length, 1).name('프레임').listen().onChange(() => { pause(); draw(); });
gui.add(options, 'method', ['3D 모델 우선', '사진 우선']).name('새 보정 입력 순서').onChange(() => { metrics(); draw(); });
gui.add(options, 'align').name('동일 기준 정렬').onChange(() => { metrics(); draw(); });
gui.add(options, 'joints').name('발 위치 표시').onChange(draw);
gui.add(options, 'speed', [.25, .5, 1]).name('재생 속도');
const playControl = gui.add(options, 'play').name('한 번 재생');
function pause() { playing = false; transport++; playControl.name('한 번 재생'); }
function points(row: typeof frames[number], baseline: boolean): PosePoints {
  const source = baseline ? row.baselinePoints : options.method === '3D 모델 우선' ? row.modelFirstPoints : row.photoFirstPoints;
  if (options.align) return alignedPose(source, fitPosePhoto(source, row.target));
  return baseline ? source.map(p => transformPhotoPoint(transformPhotoPoint(p, row.oldRegistration), row.oldCut)) : source;
}
function candidate(row: typeof frames[number]) { return options.method === '3D 모델 우선' ? row.modelFirst : row.photoFirst; }
function targetMarks(ctx: CanvasRenderingContext2D, target: PosePoints, observed?: PosePoints) {
  if (!options.joints) return;
  for (const j of feet) {
    const p = target[j], color = j % 2 ? '#0088cc' : '#e36f16';
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p[0] * 512, p[1] * 768, 3, 0, Math.PI * 2); ctx.stroke();
    if (observed) { const q = observed[j]; ctx.beginPath(); ctx.moveTo(q[0] * 512 - 4, q[1] * 768); ctx.lineTo(q[0] * 512 + 4, q[1] * 768); ctx.moveTo(q[0] * 512, q[1] * 768 - 4); ctx.lineTo(q[0] * 512, q[1] * 768 + 4); ctx.stroke(); }
  }
}
function paint(id: string, image: ImageBitmap, row: typeof frames[number], baseline?: boolean) {
  const canvas = $<HTMLCanvasElement>(id), ctx = canvas.getContext('2d')!;
  ctx.setTransform(1.5, 0, 0, 1.5, 0, 0); ctx.fillStyle = '#adb6ba'; ctx.fillRect(0, 0, 512, 768);
  ctx.save();
  if (baseline !== undefined) {
    const source = baseline ? row.baselinePoints : options.method === '3D 모델 우선' ? row.modelFirstPoints : row.photoFirstPoints;
    if (options.align) applyPhotoTransform(ctx, fitPosePhoto(source, row.target));
    else if (baseline) { applyPhotoTransform(ctx, row.oldCut); applyPhotoTransform(ctx, row.oldRegistration); }
  } else applyPhotoTransform(ctx, IDENTITY_PHOTO);
  ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, 512, 768); ctx.restore();
  targetMarks(ctx, row.target, baseline === undefined ? undefined : points(row, baseline));
  canvas.dataset.tick = String(row.tick); canvas.dataset.index = String(row.index); canvas.dataset.method = baseline === undefined ? 'model' : baseline ? 'baseline' : options.method;
}
function draw() {
  if (!ready) return;
  const row = frames[options.frame - 1];
  paint('model', bitmaps.get(url('pose-test', row.model))!, row);
  paint('baseline', bitmaps.get(url('gpt-zero', row.baseline))!, row, true);
  paint('candidate', bitmaps.get(url('pose-test', candidate(row)))!, row, false);
  $('candidate-title').textContent = options.method + ' 보정';
  $('current').textContent = `${options.frame}/${frames.length} · tick ${row.tick} · 보행 ${(row.phase * 100).toFixed(1)}% · 실제 사진 ${row.source}:${row.sourceFrame}`;
  $<HTMLImageElement>('original').src = url('gpt-zero', row.original);
  $<HTMLImageElement>('guide').src = url('pose-test', row.guide);
  document.querySelectorAll<HTMLTableRowElement>('#rows tr').forEach((tr, i) => tr.classList.toggle('active', i === options.frame - 1));
}
function metrics() {
  const sourcePoints = frames.map(row => options.method === '3D 모델 우선' ? row.modelFirstPoints : row.photoFirstPoints);
  const before = frames.map(row => points(row, true)), after = frames.map(row => points(row, false));
  const oldError = frames.map((row, i) => footRms(before[i], row.target)), newError = frames.map((row, i) => footRms(after[i], row.target));
  const oldMotion = frames.slice(1).map((row, i) => footMotionRms(before[i], before[i + 1], frames[i].target, row.target));
  const newMotion = frames.slice(1).map((row, i) => footMotionRms(after[i], after[i + 1], frames[i].target, row.target));
  const common = frames.map((_, i) => i).filter(i => [frames[i].baselinePoints, frames[i].photoFirstPoints, frames[i].modelFirstPoints].every(p => footConfidence(p) >= .5));
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  $('summary').textContent = `발 위치 차이(12장): 기존 ${average(oldError).toFixed(1)} → 새 ${average(newError).toFixed(1)} px · 프레임 사이 움직임 차이(11구간): ${average(oldMotion).toFixed(1)} → ${average(newMotion).toFixed(1)} px/frame. 공통 신뢰 ${common.length}/12장: ${average(common.map(i => oldError[i])).toFixed(1)} → ${average(common.map(i => newError[i])).toFixed(1)} px. 낮은 신뢰 표시는 직접 확인이 필요합니다.`;
  $('summary').dataset.oldFoot = String(average(oldError)); $('summary').dataset.newFoot = String(average(newError)); $('summary').dataset.oldMotion = String(average(oldMotion)); $('summary').dataset.newMotion = String(average(newMotion));
  const body = $('rows'); body.replaceChildren();
  frames.forEach((row, i) => {
    const tr = document.createElement('tr'), choose = document.createElement('button'); choose.textContent = String(i + 1); choose.onclick = () => { pause(); options.frame = i + 1; draw(); };
    const cell = document.createElement('td'); cell.append(choose); tr.append(cell);
    for (const text of [`${row.source}:${row.sourceFrame}`, oldError[i].toFixed(1), newError[i].toFixed(1), Math.min(footConfidence(row.baselinePoints), footConfidence(sourcePoints[i])) < .5 ? '낮음 · 확인' : '추정 가능']) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
    body.append(tr);
  });
}
function play() {
  if (!ready) return;
  if (playing) { pause(); return; }
  if (options.frame === frames.length) options.frame = 1;
  playing = true; const run = ++transport; playControl.name('정지'); let last = performance.now(), carry = 0; draw();
  const tick = (time: number) => {
    if (!playing || run !== transport) return;
    carry += Math.min(time - last, 200); last = time;
    const step = 1000 / data.fps / options.speed;
    while (carry >= step && options.frame < frames.length) { carry -= step; options.frame++; draw(); }
    if (options.frame === frames.length) { pause(); $('state').textContent = '12프레임 재생 완료 · 부분 구간이므로 반복하지 않습니다.'; return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
async function load() {
  for (const controller of gui.controllers) controller.disable();
  const urls = [...new Set(frames.flatMap(row => [url('pose-test', row.model), url('gpt-zero', row.baseline), url('pose-test', row.photoFirst), url('pose-test', row.modelFirst)]))];
  let next = 0, complete = 0;
  try {
    await Promise.all(Array.from({ length: 4 }, async () => { while (next < urls.length) { const file = urls[next++], response = await fetch(file); if (!response.ok) throw new Error('비교 사진 로딩 실패'); bitmaps.set(file, await createImageBitmap(await response.blob())); $('state').textContent = `비교 사진 ${++complete}/${urls.length} 준비 중…`; } }));
    ready = true; metrics(); draw(); for (const controller of gui.controllers) controller.enable();
    $('state').textContent = '준비 완료 · 양발 위치와 프레임 전환을 비교해 주세요.'; document.body.dataset.ready = 'true'; frameControl.updateDisplay();
  } catch (error) { $('state').textContent = error instanceof Error ? error.message : '준비 실패'; }
}
void load();
