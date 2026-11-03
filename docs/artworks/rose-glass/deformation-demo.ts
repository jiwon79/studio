import { applyDeformation, type Point } from '../../../pages/rose-glass/deformation';

/** One production pull map, with pressure disabled to isolate the distance rule. */
export function pullSample(point: Point, displacement: Point) {
  const radius = 210 + .25 * Math.hypot(displacement.x, displacement.y);
  const weight = Math.exp(-.5 * (point.x ** 2 + point.y ** 2) / radius ** 2);
  const moved = applyDeformation(point, { deformationFields: [{ center: { x: 0, y: 0 }, displacement, indentation: 0 }] });
  return { moved, weight, radius, distance: Math.hypot(point.x, point.y), travel: Math.hypot(moved.x - point.x, moved.y - point.y) };
}

const blue = '#235c9a', red = '#b64e3c', purple = '#78548e', gray = '#827b70';
const diagonalPull = { x: 140, y: -100 };

function lesson(id: string, title: string, instruction: string, controls: string) {
  const element = document.createElement('section'); element.id = id; element.className = 'interactive-demo deformation-lesson';
  element.setAttribute('aria-labelledby', `${id}-title`);
  element.innerHTML = `<div class="demo-heading"><h3 id="${id}-title">${title}</h3><p>${instruction}</p></div>
    <canvas class="lesson-canvas" role="img" aria-label="${title}"></canvas>
    <p class="lesson-key">빈 점: 처음 자리 · 채운 점: 이동한 자리</p>${controls}`;
  return element;
}

function painter(canvas: HTMLCanvasElement, worldHeight: number, origin = .53, originY = .5) {
  const width = canvas.clientWidth, height = canvas.clientHeight, ratio = Math.min(devicePixelRatio, 2);
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d')!; ctx.scale(ratio, ratio);
  const scale = Math.min(width / 900, height / worldHeight);
  const screen = (p: Point) => ({ x: width * origin + p.x * scale, y: height * originY + p.y * scale });
  const label = (p: Point, text: string, color = gray, dx = 8, dy = -12) => {
    const q = screen(p); ctx.font = '12px system-ui, sans-serif'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    const x = Math.max(5, Math.min(width - ctx.measureText(text).width - 5, q.x + dx)), y = Math.max(15, Math.min(height - 5, q.y + dy));
    ctx.strokeStyle = '#faf8f3'; ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
  };
  const dot = (p: Point, color: string, filled: boolean, radius = 5) => {
    const q = screen(p); ctx.beginPath(); ctx.arc(q.x, q.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = filled ? color : '#faf8f3'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  };
  const arrow = (from: Point, to: Point, color: string) => {
    const a = screen(from), b = screen(to), angle = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    if (Math.hypot(b.x - a.x, b.y - a.y) < 9) return;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - 7 * Math.cos(angle - .4), b.y - 7 * Math.sin(angle - .4)); ctx.lineTo(b.x - 7 * Math.cos(angle + .4), b.y - 7 * Math.sin(angle + .4)); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  };
  const distanceLine = (from: Point, to: Point) => {
    const a = screen(from), b = screen(to); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = '#a49b8caa'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
  };
  return { ctx, screen, dot, label, arrow, distanceLine };
}

export function createDeformationDemo() {
  const element = document.createElement('div'); element.id = 'deformation-demo'; element.className = 'deformation-sequence';
  const distance = lesson('pull-distance-demo', '1. 가까운 점이 더 많이 움직입니다', '오른쪽으로 당기는 길이를 바꿔 보세요.', `
    <label class="lesson-slider-label" for="lesson-pull">당기는 길이 <output id="lesson-pull-value"></output></label>
    <input id="lesson-pull" type="range" min="0" max="200" step="1" value="160" />
    <output class="lesson-comparison" aria-live="polite"></output>`);
  const pointLesson = lesson('pull-point-demo', '2. 한 점의 이동을 따라가 봅니다', '파란 점을 옮겨 보세요. 그림을 눌러도 됩니다.', `
    <button type="button" class="lesson-action" data-replay-point>이 점의 이동 다시 보기</button>
    <output class="lesson-point-weight" aria-live="polite"></output>
    <output class="lesson-point-calculation"></output>
    <output class="lesson-point-coordinates"></output>`);
  const grid = lesson('pull-grid-demo', '3. 같은 계산을 모든 점에 적용합니다', '슬라이더를 움직이면 격자 전체가 늘어납니다. 파란 점은 위에서 고른 점입니다.', `
    <label class="lesson-slider-label" for="lesson-progress">당김 진행 <output id="lesson-progress-value"></output></label>
    <input id="lesson-progress" type="range" min="0" max="100" step="1" value="0" />
    <button type="button" class="lesson-action" data-replay-grid>처음부터 당겨 보기</button>`);
  grid.querySelector('.lesson-key')!.textContent = '회색 점선: 원래 격자 · 파란 실선: 변형 후';
  pointLesson.querySelector('.lesson-key')!.textContent = '빨간 화살표: 당김 · 점선: 잡은 곳과의 거리';
  element.append(distance, pointLesson, grid);
  const distanceCanvas = distance.querySelector<HTMLCanvasElement>('canvas')!, pointCanvas = pointLesson.querySelector<HTMLCanvasElement>('canvas')!, gridCanvas = grid.querySelector<HTMLCanvasElement>('canvas')!;
  pointCanvas.tabIndex = 0; pointCanvas.setAttribute('aria-label', '점의 위치를 선택하는 그림. 클릭하거나 드래그하세요. 방향키로도 점을 옮길 수 있습니다.');
  const pullInput = distance.querySelector<HTMLInputElement>('#lesson-pull')!, progressInput = grid.querySelector<HTMLInputElement>('#lesson-progress')!;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let point = { x: -180, y: 100 }, trace = 1, progress = 0, traceFrame = 0, gridFrame = 0;

  const drawDistance = () => {
    const p = painter(distanceCanvas, 420, .61), displacement = { x: Number(pullInput.value), y: 0 };
    const probes = [
      { name: '잡은 곳', point: { x: 0, y: 0 }, color: red },
      { name: '가까운 점', point: { x: -80, y: -60 }, color: blue },
      { name: '먼 점', point: { x: -350, y: 140 }, color: purple },
    ];
    for (const probe of probes.slice(1)) p.distanceLine({ x: 0, y: 0 }, probe.point);
    const samples = probes.map(probe => {
      const sample = pullSample(probe.point, displacement);
      p.arrow(probe.point, sample.moved, probe.color); p.dot(probe.point, probe.color, false); p.dot(sample.moved, probe.color, true);
      p.label(probe.point, probe.name, probe.color, -15, -14); return sample;
    });
    distance.querySelector('#lesson-pull-value')!.textContent = pullInput.value;
    distance.querySelector('.lesson-comparison')!.innerHTML = probes.map((probe, i) => `<span>${probe.name}<strong style="color:${probe.color}">${samples[i].travel.toFixed(0)} 이동</strong><small>당김의 ${(samples[i].weight * 100).toFixed(0)}%</small></span>`).join('');
  };
  const drawPoint = () => {
    const p = painter(pointCanvas, 500, .53, .57), sample = pullSample(point, diagonalPull);
    p.distanceLine({ x: 0, y: 0 }, point);
    p.arrow({ x: 0, y: 0 }, diagonalPull, '#b64e3c88'); p.dot({ x: 0, y: 0 }, gray, false);
    p.label({ x: 0, y: 0 }, '잡은 곳', gray, 8, 22);
    p.arrow(point, sample.moved, blue); p.dot(point, blue, false); p.dot(sample.moved, blue, false);
    const moving = { x: point.x + (sample.moved.x - point.x) * trace, y: point.y + (sample.moved.y - point.y) * trace };
    p.dot(moving, blue, true); p.label(point, '처음', blue, -15, 23); p.label(sample.moved, '나중', blue, -10, -14);
  };
  const updatePointReadout = () => {
    const sample = pullSample(point, diagonalPull), weight = (sample.weight * 100).toFixed(1);
    pointLesson.querySelector('.lesson-point-weight')!.textContent = `잡은 곳에서 ${sample.distance.toFixed(0)} 떨어짐 → 영향 ${weight}%`;
    pointLesson.querySelector('.lesson-point-calculation')!.textContent = `당김 ${Math.hypot(diagonalPull.x, diagonalPull.y).toFixed(0)} × ${weight}% ≈ 이 점은 ${sample.travel.toFixed(1)} 이동`;
    pointLesson.querySelector('.lesson-point-coordinates')!.textContent = `처음 (${point.x.toFixed(0)}, ${point.y.toFixed(0)}) → 나중 (${sample.moved.x.toFixed(1)}, ${sample.moved.y.toFixed(1)})`;
  };
  const drawGrid = () => {
    const p = painter(gridCanvas, 500, .53, .57), displacement = { x: diagonalPull.x * progress, y: diagonalPull.y * progress };
    for (const warped of [false, true]) {
      p.ctx.strokeStyle = warped ? '#235c9ab0' : '#a49b8c88'; p.ctx.lineWidth = 1; p.ctx.setLineDash(warped ? [] : [4, 5]);
      for (const vertical of [true, false]) for (let fixed = vertical ? -400 : -200; fixed <= (vertical ? 300 : 200); fixed += 100) {
        p.ctx.beginPath();
        for (let variable = vertical ? -200 : -400; variable <= (vertical ? 200 : 300); variable += 10) {
          const input = vertical ? { x: fixed, y: variable } : { x: variable, y: fixed };
          const q = p.screen(warped ? pullSample(input, displacement).moved : input);
          if (variable === (vertical ? -200 : -400)) p.ctx.moveTo(q.x, q.y); else p.ctx.lineTo(q.x, q.y);
        }
        p.ctx.stroke();
      }
    }
    p.ctx.setLineDash([]);
    for (let x = -400; x <= 300; x += 100) for (let y = -200; y <= 200; y += 100) p.dot(pullSample({ x, y }, displacement).moved, blue, true, 2);
    const sample = pullSample(point, displacement); p.arrow(point, sample.moved, blue); p.dot(point, blue, false); p.dot(sample.moved, blue, true);
    p.label(sample.moved, '위에서 고른 점', blue, -20, -14);
    p.dot({ x: 0, y: 0 }, gray, false); p.arrow({ x: 0, y: 0 }, displacement, red);
    progressInput.value = String(Math.round(progress * 100)); grid.querySelector('#lesson-progress-value')!.textContent = `${Math.round(progress * 100)}%`;
  };
  const replayPoint = () => {
    cancelAnimationFrame(traceFrame); trace = reducedMotion.matches ? 1 : 0;
    updatePointReadout(); drawPoint(); drawGrid();
    if (reducedMotion.matches) return;
    const start = performance.now();
    const animate = (now: number) => { trace = Math.min(1, (now - start) / 700); drawPoint(); traceFrame = trace < 1 ? requestAnimationFrame(animate) : 0; };
    traceFrame = requestAnimationFrame(animate);
  };
  pullInput.addEventListener('input', drawDistance);
  pointLesson.querySelector('[data-replay-point]')!.addEventListener('click', replayPoint);
  progressInput.addEventListener('input', () => { cancelAnimationFrame(gridFrame); progress = Number(progressInput.value) / 100; drawGrid(); });
  grid.querySelector('[data-replay-grid]')!.addEventListener('click', () => {
    cancelAnimationFrame(gridFrame); progress = reducedMotion.matches ? 1 : 0; drawGrid();
    if (reducedMotion.matches) return;
    const start = performance.now();
    const animate = (now: number) => { progress = Math.min(1, (now - start) / 1000); drawGrid(); gridFrame = progress < 1 ? requestAnimationFrame(animate) : 0; };
    gridFrame = requestAnimationFrame(animate);
  });
  const pick = (event: PointerEvent) => {
    const rect = pointCanvas.getBoundingClientRect(), scale = Math.min(pointCanvas.clientWidth / 900, pointCanvas.clientHeight / 500);
    point = { x: Math.max(-400, Math.min(300, (event.clientX - rect.left - pointCanvas.clientWidth * .53) / scale)), y: Math.max(-160, Math.min(160, (event.clientY - rect.top - pointCanvas.clientHeight * .57) / scale)) };
    replayPoint();
  };
  let pointer: number | null = null;
  pointCanvas.addEventListener('pointerdown', event => {
    if (pointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointer = event.pointerId; pointCanvas.setPointerCapture(pointer); pick(event);
  });
  pointCanvas.addEventListener('pointermove', event => { if (pointer === event.pointerId) pick(event); });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) pointCanvas.addEventListener(name, event => {
    const id = (event as PointerEvent).pointerId;
    if (pointer !== id) return;
    pointer = null; if (pointCanvas.hasPointerCapture(id)) pointCanvas.releasePointerCapture(id);
  });
  pointCanvas.addEventListener('keydown', event => {
    const directions: Record<string, Point> = { ArrowLeft: { x: -20, y: 0 }, ArrowRight: { x: 20, y: 0 }, ArrowUp: { x: 0, y: -20 }, ArrowDown: { x: 0, y: 20 } };
    const change = directions[event.key]; if (!change) return;
    event.preventDefault(); point = { x: Math.max(-400, Math.min(300, point.x + change.x)), y: Math.max(-160, Math.min(160, point.y + change.y)) }; replayPoint();
  });
  new ResizeObserver(drawDistance).observe(distanceCanvas); new ResizeObserver(drawPoint).observe(pointCanvas); new ResizeObserver(drawGrid).observe(gridCanvas);
  updatePointReadout(); return element;
}
