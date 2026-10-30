import GUI from 'lil-gui';
import { fitPoseSequence } from './pose-sequence-registration';
import data from './assets/pose-test/manifest.json';
import { applyPhotoTransform, transformPhotoPoint, IDENTITY_PHOTO } from './photo-registration';
import { fitPosePhoto, alignedPose, footRms, footMotionRms, footConfidence, faceCenter, faceMotionError, torsoLeanError, upperConfidence, feet, type PosePoints } from './pose-test-metrics';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const frames = data.frames;
const files = import.meta.glob<string>('./assets/{gpt-zero,pose-test}/*.{webp,png}', { eager: true, query: '?url', import: 'default' });
const url = (group: string, name: string) => files[`./assets/${group}/${name}`];
const bitmaps = new Map<string, ImageBitmap>();
const options = { frame: 1, method: '얼굴·상체·발 보정', sequence: true, align: true, joints: true, previous: false, speed: .5, play: () => play() };
const gui = new GUI({ container: $('controls'), title: '0° 비교 옵션', width: 440 });
let ready = false, playing = false, transport = 0;
const frameControl = gui.add(options, 'frame', 1, frames.length, 1).name('프레임').listen().onChange(() => { pause(); draw(); });
gui.add(options, 'method', ['얼굴·상체·발 보정', '이전 사진 + 공동 정렬', '3D 모델 우선', '사진 우선']).name('비교할 보정').onChange(() => { metrics(); draw(); });
gui.add(options, 'sequence').name('12장 공동 정렬 · 새 사진').onChange(() => { metrics(); draw(); });
gui.add(options, 'align').name('전체 사진 정렬').onChange(() => { metrics(); draw(); });
gui.add(options, 'joints').name('관절·얼굴·상체 표시').onChange(draw);
gui.add(options, 'previous').name('이전 프레임 겹치기').onChange(draw);
gui.add(options, 'speed', [.25, .5, 1]).name('재생 속도');
const playControl = gui.add(options, 'play').name('한 번 재생');
function pause() { playing = false; transport++; playControl.name('한 번 재생'); }
type Frame = typeof frames[number];
const upperExperiment = () => options.method === '얼굴·상체·발 보정' || options.method === '이전 사진 + 공동 정렬';
const selectedPoints = (row: Frame): PosePoints => options.method === '얼굴·상체·발 보정' ? row.headBodyPoints : options.method === '사진 우선' ? row.photoFirstPoints : row.modelFirstPoints;
const rawPoints = (row: Frame, baseline: boolean): PosePoints => baseline ? upperExperiment() ? row.modelFirstPoints : row.baselinePoints : selectedPoints(row);
const sequenceTargets = frames.map(row => row.target.map((p, j) => j === 2 ? row.headTarget.leftEye : j === 5 ? row.headTarget.rightEye : p));
const sequenceFits = {
  next: fitPoseSequence(frames.map(row => row.headBodyPoints), sequenceTargets),
  previous: fitPoseSequence(frames.map(row => row.modelFirstPoints), sequenceTargets),
};
function transform(row: Frame, baseline: boolean) {
  if (!baseline && upperExperiment() && options.sequence)
    return (options.method === '얼굴·상체·발 보정' ? sequenceFits.next : sequenceFits.previous)[row.tick];
  return fitPosePhoto(rawPoints(row, baseline), row.target);
}
function points(row: Frame, baseline: boolean): PosePoints {
  const source = rawPoints(row, baseline);
  if (options.align) return alignedPose(source, transform(row, baseline));
  return baseline && !upperExperiment() ? source.map(p => transformPhotoPoint(transformPhotoPoint(p, row.oldRegistration), row.oldCut)) : source;
}
function picture(row: Frame, baseline: boolean) {
  if (baseline) return upperExperiment() ? url('pose-test', row.modelFirst) : url('gpt-zero', row.baseline);
  return url('pose-test', options.method === '얼굴·상체·발 보정' ? row.headBody : options.method === '사진 우선' ? row.photoFirst : row.modelFirst);
}
function targetMarks(ctx: CanvasRenderingContext2D, row: Frame, observed?: PosePoints) {
  if (!options.joints) return;
  const target = row.target, eye = row.headTarget.eye;
  ctx.strokeStyle = '#287400'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(eye[0] * 512 - 8, eye[1] * 768); ctx.lineTo(eye[0] * 512 + 8, eye[1] * 768); ctx.moveTo(eye[0] * 512, eye[1] * 768 - 8); ctx.lineTo(eye[0] * 512, eye[1] * 768 + 8); ctx.stroke();
  for (const j of [...feet, 11, 12, 23, 24]) {
    const p = target[j], color = j % 2 ? '#0088cc' : '#e36f16';
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p[0] * 512, p[1] * 768, 3, 0, Math.PI * 2); ctx.stroke();
    if (observed) { const q = observed[j]; ctx.beginPath(); ctx.moveTo(q[0] * 512 - 4, q[1] * 768); ctx.lineTo(q[0] * 512 + 4, q[1] * 768); ctx.moveTo(q[0] * 512, q[1] * 768 - 4); ctx.lineTo(q[0] * 512, q[1] * 768 + 4); ctx.stroke(); }
  }
  const axis = (p: PosePoints, color: string) => {
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    const shoulder = [0, 1].map(k => (p[11][k] + p[12][k]) / 2), hip = [0, 1].map(k => (p[23][k] + p[24][k]) / 2);
    ctx.beginPath(); ctx.moveTo(shoulder[0] * 512, shoulder[1] * 768); ctx.lineTo(hip[0] * 512, hip[1] * 768); ctx.stroke();
  };
  axis(target, '#f58025');
  if (observed) {
    axis(observed, '#fff');
    const face = faceCenter(observed); ctx.strokeStyle = '#adff61'; ctx.beginPath(); ctx.arc(face[0] * 512, face[1] * 768, 7, 0, Math.PI * 2); ctx.stroke();
  }
}
function paint(id: string, image: ImageBitmap, row: typeof frames[number], baseline?: boolean) {
  const canvas = $<HTMLCanvasElement>(id), ctx = canvas.getContext('2d')!;
  ctx.setTransform(1.5, 0, 0, 1.5, 0, 0); ctx.fillStyle = '#adb6ba'; ctx.fillRect(0, 0, 512, 768);
  ctx.save();
  if (baseline !== undefined) {
    if (options.align) applyPhotoTransform(ctx, transform(row, baseline));
    else if (baseline && !upperExperiment()) { applyPhotoTransform(ctx, row.oldCut); applyPhotoTransform(ctx, row.oldRegistration); }
  } else applyPhotoTransform(ctx, IDENTITY_PHOTO);
  ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, 512, 768); ctx.restore();
  if (baseline !== undefined && options.previous && options.frame > 1) {
    const previous = frames[options.frame - 2], priorPoints = points(previous, baseline);
    ctx.save(); ctx.globalAlpha = .35;
    if (options.align) applyPhotoTransform(ctx, transform(previous, baseline));
    else if (baseline && !upperExperiment()) { applyPhotoTransform(ctx, previous.oldCut); applyPhotoTransform(ctx, previous.oldRegistration); }
    const bitmap = bitmaps.get(picture(previous, baseline))!;
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, 512, 768); ctx.restore();
    const face = faceCenter(priorPoints); ctx.strokeStyle = '#cf43ed'; ctx.beginPath(); ctx.arc(face[0] * 512, face[1] * 768, 7, 0, Math.PI * 2); ctx.stroke();
  }
  targetMarks(ctx, row, baseline === undefined ? undefined : points(row, baseline));
  canvas.dataset.tick = String(row.tick); canvas.dataset.index = String(row.index); canvas.dataset.method = baseline === undefined ? 'model' : baseline ? 'baseline' : options.method;
}
function draw() {
  if (!ready) return;
  const row = frames[options.frame - 1];
  paint('model', bitmaps.get(url('pose-test', row.model))!, row);
  paint('baseline', bitmaps.get(picture(row, true))!, row, true);
  paint('candidate', bitmaps.get(picture(row, false))!, row, false);
  $('candidate-title').textContent = options.method;
  $('baseline-title').textContent = upperExperiment() ? '이전 3D 보정' : '기존 GPT 보정';
  $('registration-state').textContent = !options.align ? '전체 사진 정렬 OFF · 생성된 위치 그대로' : upperExperiment() && options.sequence ? '이전: 프레임별 정렬 / 새 사진: 얼굴·발 이동과 상체 축을 12장 공동 정렬. 생성 편집과 재생 정렬을 합친 결과입니다.' : '두 사진 모두 같은 프레임별 전체 사진 정렬 · 공동 정렬 OFF';
  $('current').textContent = `${options.frame}/${frames.length} · tick ${row.tick} · 보행 ${(row.phase * 100).toFixed(1)}% · 실제 사진 ${row.source}:${row.sourceFrame}`;
  $<HTMLImageElement>('original').src = url('gpt-zero', row.original);
  $<HTMLImageElement>('guide').src = url('pose-test', row.upperGuide);
  document.querySelectorAll<HTMLTableRowElement>('#rows tr').forEach((tr, i) => tr.classList.toggle('active', i === options.frame - 1));
}
const averageValue = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
function metrics() {
  const sourcePoints = frames.map(selectedPoints);
  const before = frames.map(row => points(row, true)), after = frames.map(row => points(row, false));
  const oldError = frames.map((row, i) => footRms(before[i], row.target)), newError = frames.map((row, i) => footRms(after[i], row.target));
  const oldMotion = frames.slice(1).map((row, i) => footMotionRms(before[i], before[i + 1], frames[i].target, row.target));
  const newMotion = frames.slice(1).map((row, i) => footMotionRms(after[i], after[i + 1], frames[i].target, row.target));
  const headBefore = frames.slice(1).map((row, i) => faceMotionError(before[i], before[i + 1], frames[i].target, row.target));
  const headAfter = frames.slice(1).map((row, i) => faceMotionError(after[i], after[i + 1], frames[i].target, row.target));
  const leanBefore = frames.map((row, i) => torsoLeanError(before[i], row.target)), leanAfter = frames.map((row, i) => torsoLeanError(after[i], row.target));
  const faceOffsets = (poses: readonly PosePoints[]) => poses.map((pose, i) => { const eye = faceCenter(pose), target = frames[i].headTarget.eye; return Math.hypot((eye[0] - target[0]) * 512, (eye[1] - target[1]) * 768); });
  const worstHead = headAfter.indexOf(Math.max(...headAfter)) + 1;
  $('upper-summary').textContent = `가상 눈 기준 위치 차이: 평균 ${averageValue(faceOffsets(before)).toFixed(1)} → ${averageValue(faceOffsets(after)).toFixed(1)} px. 얼굴 이동 차이: 기존 평균 ${averageValue(headBefore).toFixed(1)} / 최대 ${Math.max(...headBefore).toFixed(1)} → 새 평균 ${averageValue(headAfter).toFixed(1)} / 최대 ${Math.max(...headAfter).toFixed(1)} px. 새 보정의 최대 구간은 ${worstHead}→${worstHead + 1}번입니다. 상체 기울기 차이: 기존 최대 ${Math.max(...leanBefore.map(Math.abs)).toFixed(1)}° → 새 최대 ${Math.max(...leanAfter.map(Math.abs)).toFixed(1)}°. 아래 표에서 모든 전환을 확인할 수 있습니다.`;
  $('upper-summary').dataset.faceMax = String(Math.max(...headAfter)); $('upper-summary').dataset.leanMax = String(Math.max(...leanAfter.map(Math.abs)));
  const common = frames.map((_, i) => i).filter(i => [rawPoints(frames[i], true), sourcePoints[i]].every(p => footConfidence(p) >= .5));
  const average = averageValue;
  $('summary').textContent = `발 위치 차이(12장): 기존 ${average(oldError).toFixed(1)} → 새 ${average(newError).toFixed(1)} px · 프레임 사이 움직임 차이(11구간): ${average(oldMotion).toFixed(1)} → ${average(newMotion).toFixed(1)} px/frame. 공통 신뢰 ${common.length}/12장: ${average(common.map(i => oldError[i])).toFixed(1)} → ${average(common.map(i => newError[i])).toFixed(1)} px. 낮은 신뢰 표시는 직접 확인이 필요합니다.`;
  $('summary').dataset.oldFoot = String(average(oldError)); $('summary').dataset.newFoot = String(average(newError)); $('summary').dataset.oldMotion = String(average(oldMotion)); $('summary').dataset.newMotion = String(average(newMotion));
  const body = $('rows'); body.replaceChildren();
  frames.forEach((row, i) => {
    const tr = document.createElement('tr'), choose = document.createElement('button'); choose.textContent = String(i + 1); choose.onclick = () => { pause(); options.frame = i + 1; draw(); };
    const cell = document.createElement('td'); cell.append(choose); tr.append(cell);
    for (const text of [`${row.source}:${row.sourceFrame}`, oldError[i].toFixed(1), newError[i].toFixed(1), i ? `${headBefore[i - 1].toFixed(1)} → ${headAfter[i - 1].toFixed(1)}` : '—', `${leanBefore[i].toFixed(1)} → ${leanAfter[i].toFixed(1)}°`, upperConfidence(sourcePoints[i]) < .5 ? '상체 낮음 · 확인' : Math.min(footConfidence(rawPoints(row, true)), footConfidence(sourcePoints[i])) < .5 ? '낮음 · 확인' : '추정 가능']) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
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
  const urls = [...new Set(frames.flatMap(row => [url('pose-test', row.model), url('gpt-zero', row.baseline), url('pose-test', row.photoFirst), url('pose-test', row.modelFirst), url('pose-test', row.headBody)]))];
  let next = 0, complete = 0;
  try {
    await Promise.all(Array.from({ length: 4 }, async () => { while (next < urls.length) { const file = urls[next++], response = await fetch(file); if (!response.ok) throw new Error('비교 사진 로딩 실패'); bitmaps.set(file, await createImageBitmap(await response.blob())); $('state').textContent = `비교 사진 ${++complete}/${urls.length} 준비 중…`; } }));
    ready = true; metrics(); draw(); for (const controller of gui.controllers) controller.enable();
    $('state').textContent = '준비 완료 · 양발 위치와 프레임 전환을 비교해 주세요.'; document.body.dataset.ready = 'true'; frameControl.updateDisplay();
  } catch (error) { $('state').textContent = error instanceof Error ? error.message : '준비 실패'; }
}
void load();
