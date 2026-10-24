import { applyDeformation, invertDeformation, rotate, foregroundGlassShape, glassBodyWidthAt,
  type Point, type InverseDeformationStep, type DeformationState } from '../../../pages/rose-glass/deformation';
import { GlassBodyMotion } from '../../../pages/rose-glass/interaction';
import { outlinePoint } from './outline-demo';

function inspectMaterialInverse(target: Point, state: DeformationState) {
  const steps: InverseDeformationStep[] = [];
  const source = invertDeformation(target, state, step => steps.push(step));
  const reconstructed = applyDeformation(source, state);
  return { target, source, steps, residual: Math.hypot(reconstructed.x - target.x, reconstructed.y - target.y) };
}

export function inspectInverse(point: Point, motion: GlassBodyMotion) {
  const target = rotate({ x: point.x - foregroundGlassShape.x - motion.x, y: point.y - foregroundGlassShape.y - motion.y }, -motion.angle);
  return inspectMaterialInverse(target, motion);
}

/** Only the last small map: keep its intermediate target separate from the full inverse result. */
export function inverseCorrectionSamples(result: ReturnType<typeof inspectInverse>, state: DeformationState) {
  const first = result.steps[0];
  if (!first) return [];
  const steps = result.steps.filter(step => step.fieldIndex === first.fieldIndex);
  const last = steps[steps.length - 1];
  const finalForward = applyDeformation(last.next, { deformationFields: [state.deformationFields[first.fieldIndex]] });
  return [...steps.map(step => ({ guess: step.guess, forward: step.forward, target: step.target })),
    { guess: last.next, forward: finalForward, target: last.target }];
}

const blue = '#235c9a', red = '#b64e3c', gray = '#827b70';
const pair = (p: Point) => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`;
const length = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function card(id: string, title: string, description: string, body: string) {
  const element = document.createElement('section'); element.id = id; element.className = 'interactive-demo inverse-lesson';
  element.setAttribute('aria-labelledby', `${id}-title`);
  element.innerHTML = `<div class="demo-heading"><h3 id="${id}-title">${title}</h3><p>${description}</p></div>${body}`;
  return element;
}

function paint(canvas: HTMLCanvasElement) {
  const width = canvas.clientWidth, height = canvas.clientHeight, ratio = Math.min(devicePixelRatio, 2);
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d')!; ctx.scale(ratio, ratio);
  const dot = (p: Point, color: string, hollow = false) => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI); ctx.fillStyle = hollow ? '#faf8f3' : color; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  };
  const label = (text: string, x: number, y: number, color = gray) => {
    ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = color;
    const textWidth = ctx.measureText(text).width, centered = ctx.textAlign === 'center';
    const start = centered ? textWidth / 2 + 4 : 4, end = width - (centered ? textWidth / 2 + 4 : textWidth + 4);
    ctx.fillText(text, Math.max(start, Math.min(end, x)), Math.max(14, Math.min(height - 5, y)));
  };
  const arrow = (from: Point, to: Point) => {
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.strokeStyle = '#faf8f3'; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = '#235c9a99'; ctx.lineWidth = 1.5; ctx.stroke();
    const a = Math.atan2(to.y - from.y, to.x - from.x);
    ctx.beginPath(); ctx.moveTo(to.x, to.y); ctx.lineTo(to.x - 7 * Math.cos(a - .4), to.y - 7 * Math.sin(a - .4));
    ctx.lineTo(to.x - 7 * Math.cos(a + .4), to.y - 7 * Math.sin(a + .4)); ctx.closePath(); ctx.fillStyle = blue; ctx.fill();
  };
  return { ctx, width, height, dot, label, arrow };
}

const inside = (p: Point) => {
  const y = p.y / foregroundGlassShape.height, x = (p.x - p.y * foregroundGlassShape.shear) / glassBodyWidthAt(2, y);
  return Math.abs(x) ** foregroundGlassShape.exponent + Math.abs(y) ** foregroundGlassShape.exponent <= 1;
};

function drawGlass(ctx: CanvasRenderingContext2D, project: (p: Point) => Point) {
  ctx.beginPath();
  for (let i = 0; i <= 160; i++) {
    const p = project(outlinePoint(i / 160 * 2 * Math.PI, foregroundGlassShape.exponent, 3));
    if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
  }
  ctx.closePath(); ctx.fillStyle = '#eed8d455'; ctx.fill(); ctx.strokeStyle = '#c6aea4'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = '#3b687a88';
  for (const vertical of [true, false]) for (let fixed = -375; fixed <= 375; fixed += 75) {
    ctx.beginPath(); let pen = false;
    for (let variable = -390; variable <= 390; variable += 8) {
      const p = vertical ? { x: fixed, y: variable } : { x: variable, y: fixed };
      if (!inside(p)) { pen = false; continue; }
      const q = project(p); if (pen) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); pen = true;
    }
    ctx.stroke();
  }
}

/** A fixed production pull gives the two explanatory cards the same stable example. */
export function createInverseDemos() {
  const motion = new GlassBodyMotion();
  motion.grab(-1, { x: 420, y: 645 }); motion.move(-1, { x: 600, y: 580 });
  for (let i = 0; i < 90; i++) motion.step(1 / 60, 85, 1, { softness: 1.1, indentationDepth: 1, recovery: 1, stretchLimit: 430 }, false);
  const correspondence = card('inverse-debug', '국소 변형 · 2. 지금 점의 원래 자리',
    '오른쪽 유리에서 점을 옮겨 보세요. 왼쪽 점이 원래 자리입니다.', `
    <canvas class="inverse-map" tabindex="0" role="img" aria-label="왼쪽은 원래 유리, 오른쪽은 늘어난 유리입니다. 오른쪽을 누르거나 점을 드래그하세요. 방향키로도 점을 옮길 수 있습니다."></canvas>
    <output class="inverse-pair" aria-live="polite"></output>
    <p class="inverse-caption">이 원래 자리에서 색과 무늬를 계산합니다.</p>`);
  const correction = card('inverse-steps', '국소 변형 · 3. 추정한 자리를 고치기',
    '위에서 고른 점을 마지막 작은 변형 직전으로 돌려 봅니다.', `
    <canvas class="inverse-correction" role="img" aria-label="왼쪽은 추정 위치, 오른쪽은 그 위치를 변형해 본 결과와 목표입니다. 보정할수록 오른쪽 파란 점이 빨간 목표에 가까워집니다."></canvas>
    <p class="inverse-caption">점 주변을 확대한 그림입니다. 두 그림의 배율은 같습니다.</p>
    <div class="inverse-progress"><span data-correction-count></span><output data-correction-error aria-live="polite"></output></div>
    <div class="inverse-actions"><button type="button" data-correct>한 번 보정하기</button><button type="button" data-restart>처음부터</button></div>
    <output class="inverse-explanation"></output>`);
  const map = correspondence.querySelector<HTMLCanvasElement>('canvas')!, plot = correction.querySelector<HTMLCanvasElement>('canvas')!;
  const nextButton = correction.querySelector<HTMLButtonElement>('[data-correct]')!;
  let selected = { x: 110, y: 0 }, iteration = 0;
  let result = inspectMaterialInverse(selected, motion), samples = inverseCorrectionSamples(result, motion);
  const mapScale = () => Math.min((map.clientWidth / 2 - 20) / 800, (map.clientHeight - 40) / 900);
  const drawMap = () => {
    const p = paint(map), scale = mapScale();
    const left = (q: Point) => ({ x: p.width * .25 + q.x * scale, y: p.height * .55 + q.y * scale });
    const right = (q: Point) => ({ x: p.width * .75 + (q.x - 65) * scale, y: p.height * .55 + q.y * scale });
    p.ctx.textAlign = 'center'; p.label('원래 유리', p.width * .25, 18); p.label('늘어난 유리', p.width * .75, 18); p.ctx.textAlign = 'start';
    drawGlass(p.ctx, left); drawGlass(p.ctx, q => right(applyDeformation(q, motion)));
    const a = left(result.source), b = right(selected); p.arrow(b, a); p.dot(a, blue); p.dot(b, red);
    p.label('P', a.x - 16, a.y - 10, blue); p.label('Q', b.x + 9, b.y + 15, red);
  };
  const drawCorrection = () => {
    const p = paint(plot), current = samples[iteration];
    const start = samples[0], end = samples[samples.length - 1];
    const scale = Math.min((p.width / 2 - 48) / Math.max(20, length(start.guess, end.guess)), (p.height - 85) / Math.max(20, length(start.forward, start.target)));
    const midpoint = { x: (start.guess.x + end.guess.x) / 2, y: (start.guess.y + end.guess.y) / 2 };
    const left = (q: Point) => ({ x: p.width * .25 + (q.x - midpoint.x) * scale, y: p.height * .57 + (q.y - midpoint.y) * scale });
    const comparisonCenter = { x: (start.forward.x + start.target.x) / 2, y: (start.forward.y + start.target.y) / 2 };
    const right = (q: Point) => ({ x: p.width * .75 + (q.x - comparisonCenter.x) * scale, y: p.height * .57 + (q.y - comparisonCenter.y) * scale });
    p.ctx.textAlign = 'center'; p.label('한 단계 전 위치 추정', p.width * .25, 18); p.label('다시 변형해 본 결과', p.width * .75, 18); p.ctx.textAlign = 'start';
    p.ctx.strokeStyle = '#d5cbb9'; p.ctx.lineWidth = 1; p.ctx.beginPath(); p.ctx.moveTo(p.width / 2, 32); p.ctx.lineTo(p.width / 2, p.height - 10); p.ctx.stroke();
    const first = left(start.guess), guess = left(current.guess), target = right(current.target), forward = right(current.forward);
    if (iteration) { p.dot(first, gray, true); p.label('첫 추정', first.x - 12, first.y + 22); p.arrow(first, guess); }
    p.dot(guess, blue); p.label(iteration ? '지금 추정' : '첫 추정', guess.x - 18, guess.y - 14, blue);
    if (length(forward, target) > 1) p.arrow(forward, target);
    p.dot(target, red, true); p.dot(forward, blue);
    const error = length(current.forward, current.target);
    if (length(forward, target) < 12) p.label(error < .001 ? '목표와 일치' : '목표 가까이', target.x - 30, target.y + 24, red);
    else { p.label('목표', target.x - 24, target.y + 23, red); p.label('변형 결과', forward.x - 30, forward.y - 12, blue); }
    correction.querySelector('[data-correction-count]')!.textContent = `보정 ${iteration} / ${samples.length - 1}`;
    correction.querySelector('[data-correction-error]')!.textContent = `목표와의 거리 ${error.toFixed(3)}`;
    correction.querySelector('.inverse-explanation')!.textContent = iteration === 0
      ? '현재 위치를 첫 추정으로 삼습니다. 앞으로 변형해 보니 목표에서 벗어납니다.'
      : iteration < samples.length - 1
        ? '목표와의 차이를 줄이도록 추정을 옮겼습니다. 앞으로 변형한 결과가 목표에 가까워집니다.'
        : '작은 변형 하나를 되돌렸습니다. 남은 세 변형도 거꾸로 같은 과정을 반복합니다.';
    nextButton.disabled = iteration === samples.length - 1;
  };
  const updateSelection = (point: Point) => {
    if (!inside(invertDeformation(point, motion))) return;
    selected = point; iteration = 0; result = inspectMaterialInverse(selected, motion); samples = inverseCorrectionSamples(result, motion);
    correspondence.querySelector('.inverse-pair')!.textContent = `현재 Q ${pair(selected)} → 원래 P ${pair(result.source)}`;
    map.setAttribute('aria-description', `현재 위치 ${pair(selected)}의 원래 위치는 ${pair(result.source)}입니다.`);
    drawMap(); drawCorrection();
  };
  const pick = (event: PointerEvent) => {
    const rect = map.getBoundingClientRect(), x = event.clientX - rect.left - map.clientLeft, y = event.clientY - rect.top - map.clientTop;
    if (x < map.clientWidth / 2) return;
    updateSelection({ x: (x - map.clientWidth * .75) / mapScale() + 65, y: (y - map.clientHeight * .55) / mapScale() });
  };
  let pointer: number | null = null;
  map.addEventListener('pointerdown', event => {
    if (pointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointer = event.pointerId; map.setPointerCapture(pointer); pick(event);
  });
  map.addEventListener('pointermove', event => { if (pointer === event.pointerId) pick(event); });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) map.addEventListener(name, event => {
    const id = (event as PointerEvent).pointerId; if (pointer !== id) return;
    pointer = null; if (map.hasPointerCapture(id)) map.releasePointerCapture(id);
  });
  map.addEventListener('keydown', event => {
    const directions: Record<string, Point> = { ArrowLeft: { x: -20, y: 0 }, ArrowRight: { x: 20, y: 0 }, ArrowUp: { x: 0, y: -20 }, ArrowDown: { x: 0, y: 20 } };
    const d = directions[event.key]; if (!d) return; event.preventDefault(); updateSelection({ x: selected.x + d.x, y: selected.y + d.y });
  });
  nextButton.addEventListener('click', () => { iteration = Math.min(samples.length - 1, iteration + 1); drawCorrection(); });
  correction.querySelector('[data-restart]')!.addEventListener('click', () => { iteration = 0; drawCorrection(); });
  new ResizeObserver(drawMap).observe(map); new ResizeObserver(drawCorrection).observe(plot);
  correspondence.querySelector('.inverse-pair')!.textContent = `현재 Q ${pair(selected)} → 원래 P ${pair(result.source)}`;
  return { correspondence, correction };
}
