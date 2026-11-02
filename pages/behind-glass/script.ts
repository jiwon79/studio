import GUI from 'lil-gui';
import './style.css';
import { footPose, legPose, pelvisHeight, FOOT_LIFT, STRIDE, wrapPosition, type FootPose } from './motion';

const canvas = document.querySelector('canvas')!;
const ctx = canvas.getContext('2d', { alpha: false })!;
const button = document.querySelector<HTMLButtonElement>('.playback')!;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const settings = { speed: 1, blur: 1, scale: 1, people: 4 };
let width = 0;
let height = 0;
let pixelRatio = 1;
const query = new URLSearchParams(location.search);
const inspectionTime = query.has('debug') ? Number(query.get('time')) : NaN;
let elapsed = query.has('time') && Number.isFinite(inspectionTime) ? inspectionTime : 1.1;
let previous = 0;
let paused = reducedMotion.matches || (query.has('debug') && query.has('time'));
let frame = 0;

const layers = Array.from({ length: 3 }, () => {
  const element = document.createElement('canvas');
  return { element, context: element.getContext('2d')! };
});
// Distinct routes, headings and cadences avoid a marching, synchronized crowd.
// Motion reference: https://x.com/nusretuzman/status/2114480094840570247
// All shapes and motion are procedural; no source video or imagery is shipped.
const walkers = [
  { x: .05, y: .30, angle: 1.67, period: 1.20, phase: .12, size: .98 },
  { x: .86, y: .79, angle: .08, period: 1.32, phase: .67, size: 1.06 },
  { x: .43, y: .78, angle: -1.67, period: 1.12, phase: .35, size: .98 },
  { x: .65, y: .24, angle: -.08, period: 1.38, phase: .82, size: 1.02 },
  { x: .20, y: .78, angle: -2.40, period: 1.27, phase: .48, size: .96 },
  { x: .92, y: .15, angle: .40, period: 1.17, phase: .91, size: 1.04 },
];

const stories = [
  { destination: '집으로 가는 사람', thought: '오늘은 아무 말도 하지 않고 쉬고 싶다.' },
  { destination: '누군가를 만나러 가는 사람', thought: '먼저 와 있다고 할까, 아직 가는 중이라고 할까.' },
  { destination: '조금 늦은 사람', thought: '뛰면 더 늦은 사람처럼 보이겠지.' },
  { destination: '그냥 걷는 사람', thought: '목적지가 없어도 걷는 건 좋다.' },
  { destination: '다시 돌아가는 사람', thought: '아까 그 길로 한 번 더 걸어 볼까.' },
  { destination: '아직 가는 중인 사람', thought: '조금 천천히 가도 괜찮겠지.' },
];
const people = document.querySelector<HTMLDivElement>('.people')!;
const thought = document.querySelector<HTMLElement>('.thought')!;
const destination = document.querySelector<HTMLElement>('.destination')!;
const sentence = document.querySelector<HTMLElement>('.sentence')!;
const closeThought = document.querySelector<HTMLButtonElement>('.thought-close')!;
const walkerTimes = walkers.map(() => elapsed);
const walkerSpeeds = walkers.map(() => 1);
const anchors: { x: number; y: number; scale: number }[] = [];
let selected = -1;
let selectionRemaining = 0;
const personButtons = walkers.map((_, index) => {
  const target = document.createElement('button');
  target.type = 'button';
  target.className = 'person';
  target.setAttribute('aria-label', `${stories[index].destination}의 생각 보기`);
  target.setAttribute('aria-expanded', 'false');
  const label = document.createElement('span');
  label.textContent = stories[index].destination;
  target.append(label);
  target.addEventListener('click', () => {
    if (selected === index) dismissThought();
    else {
      selected = index;
      selectionRemaining = 8;
      destination.textContent = stories[index].destination;
      sentence.textContent = stories[index].thought;
      thought.hidden = false;
      syncSelection();
      render();
    }
  });
  people.append(target);
  return target;
});
function syncSelection() {
  personButtons.forEach((target, i) => target.setAttribute('aria-expanded', String(i === selected)));
}
function dismissThought() {
  selected = -1;
  thought.hidden = true;
  syncSelection();
}
closeThought.addEventListener('click', dismissThought);
canvas.addEventListener('click', dismissThought);
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && selected >= 0) {
    const target = personButtons[selected];
    dismissThought();
    target.focus({ preventScroll: true });
  }
});

function positionThought() {
  if (selected < 0) return;
  const anchor = anchors[selected];
  if (!anchor) return;
  const gutter = 18;
  const cardWidth = thought.offsetWidth;
  const cardHeight = thought.offsetHeight;
  let left = anchor.x + 48 * anchor.scale;
  if (left + cardWidth > width - gutter) left = anchor.x - cardWidth - 48 * anchor.scale;
  left = Math.max(gutter, Math.min(width - cardWidth - gutter, left));
  const top = Math.max(gutter, Math.min(height - cardHeight - 82, anchor.y - cardHeight / 2));
  thought.style.transform = `translate(${left}px, ${top}px)`;
}

function resize() {
  width = innerWidth;
  height = innerHeight;
  pixelRatio = Math.min(devicePixelRatio, 1.5);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  for (const layer of layers) {
    layer.element.width = canvas.width;
    layer.element.height = canvas.height;
  }
  render();
}

interface Point { x: number; y: number }

function limb(c: CanvasRenderingContext2D, a: Point, b: Point, startWidth: number, endWidth: number, nearAlpha: number, farAlpha: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < .01) return;
  const nx = -dy / length;
  const ny = dx / length;
  const gradient = c.createLinearGradient(a.x, a.y, b.x, b.y);
  gradient.addColorStop(0, `rgba(17,18,20,${nearAlpha})`);
  gradient.addColorStop(1, `rgba(17,18,20,${farAlpha})`);
  c.fillStyle = gradient;
  c.beginPath();
  c.moveTo(a.x + nx * startWidth / 2, a.y + ny * startWidth / 2);
  c.lineTo(b.x + nx * endWidth / 2, b.y + ny * endWidth / 2);
  c.quadraticCurveTo(b.x + dx / length * endWidth / 3, b.y + dy / length * endWidth / 3, b.x - nx * endWidth / 2, b.y - ny * endWidth / 2);
  c.lineTo(a.x - nx * startWidth / 2, a.y - ny * startWidth / 2);
  c.quadraticCurveTo(a.x - dx / length * startWidth / 3, a.y - dy / length * startWidth / 3, a.x + nx * startWidth / 2, a.y + ny * startWidth / 2);
  c.fill();
}

function legSilhouette(c: CanvasRenderingContext2D, ankle: Point, knee: Point, hip: Point, lift: number) {
  const normal = (a: Point, b: Point, radius: number) => {
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / length * radius, y: (b.x - a.x) / length * radius };
  };
  const a = normal(ankle, knee, 10);
  const k = normal(ankle, hip, 14);
  const h = normal(knee, hip, 17);
  const gradient = c.createLinearGradient(ankle.x, ankle.y, hip.x, hip.y);
  gradient.addColorStop(0, `rgba(16,17,19,${.87 - lift * .12})`);
  gradient.addColorStop(.38, 'rgba(16,17,19,.65)');
  gradient.addColorStop(.72, 'rgba(16,17,19,.30)');
  gradient.addColorStop(1, 'rgba(16,17,19,0)');
  c.fillStyle = gradient;
  c.beginPath();
  c.moveTo(ankle.x + a.x, ankle.y + a.y);
  c.lineTo(knee.x + k.x, knee.y + k.y);
  c.quadraticCurveTo(hip.x + h.x, hip.y + h.y, hip.x, hip.y);
  c.quadraticCurveTo(hip.x - h.x, hip.y - h.y, knee.x - k.x, knee.y - k.y);
  c.lineTo(ankle.x - a.x, ankle.y - a.y);
  c.closePath();
  c.fill();
}

function sole(c: CanvasRenderingContext2D, position: Point, side: number, angle: number, pose: FootPose) {
  c.save();
  c.translate(position.x, position.y);
  c.rotate(angle + side * .035);
  // Roll around the toe, so the heel rises without dragging the contact point.
  c.translate(0, -23);
  c.scale(1 - pose.lift * .04, Math.cos(pose.roll));
  c.translate(0, 23);
  c.fillStyle = `rgba(9,10,12,${.98 - pose.lift * .24})`;
  c.beginPath();
  c.moveTo(-8, 20);
  c.bezierCurveTo(-12, 16, -9, 7, -10, 1);
  c.bezierCurveTo(-13, -10, -13, -21, -6, -25);
  c.bezierCurveTo(1, -28, 12, -26, 13, -17);
  c.bezierCurveTo(14, -8, 10, 2, 9, 9);
  c.bezierCurveTo(10, 19, 5, 23, -1, 23);
  c.bezierCurveTo(-4, 23, -7, 22, -8, 20);
  c.fill();
  c.restore();
}

function sceneScale() {
  return Math.max(.65, Math.min(width / 1150, height / 760, 1.35)) * settings.scale;
}

function renderWalker(walker: typeof walkers[number], index: number) {
  const time = walkerTimes[index];
  const scale = sceneScale() * walker.size;
  const cycle = time / walker.period + walker.phase;
  const distance = time * STRIDE / walker.period * scale;
  const x = wrapPosition(walker.x * width + Math.sin(walker.angle) * distance, width, 180 * scale);
  const y = wrapPosition(walker.y * height - Math.cos(walker.angle) * distance, height, 180 * scale);
  anchors[index] = { x, y, scale };
  const target = personButtons[index];
  target.hidden = x < 12 || x > width - 12 || y < 24 || y > height - 52;
  const targetWidth = Math.max(86, 112 * scale);
  const targetHeight = Math.max(112, 160 * scale);
  target.style.width = `${targetWidth}px`;
  target.style.height = `${targetHeight}px`;
  target.style.transform = `translate(${x - targetWidth / 2}px, ${y - targetHeight + 30 * scale}px)`;
  // Camera projection is shared by every person. Height recedes up the glass,
  // not backwards along each walking direction like a trailing shadow.
  const riseX = (width * .5 - x) / width * .95;
  const riseY = -.98;
  const sin = Math.sin(walker.angle);
  const cos = Math.cos(walker.angle);
  const project = (side: number, forward: number, elevation: number): Point => ({
    x: cos * side + sin * forward + riseX * elevation,
    y: sin * side - cos * forward + riseY * elevation,
  });
  for (const { context: c } of layers) {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
  }
  const far = layers[0].context;
  const legs = layers[1].context;
  const feet = layers[2].context;
  const hipHeight = pelvisHeight(cycle);
  for (const side of [-1, 1]) {
    const pose = footPose(cycle + (side === 1 ? .5 : 0), STRIDE);
    const joints = legPose(pose, hipHeight);
    const ankle = project(side * 14, joints.ankle.forward, joints.ankle.height);
    const knee = project(side * 12, joints.knee.forward, joints.knee.height);
    const hip = project(side * 10, joints.hip.forward, joints.hip.height);
    // Only the legs survive the frosted surface. The upper thigh fades to zero;
    // there is no separate head/shoulder blob extending beyond it.
    const diffuseEnd = project(side * 10, joints.hip.forward, joints.hip.height + 32);
    limb(far, knee, diffuseEnd, 32, 46, .26, 0);
    legSilhouette(legs, ankle, knee, hip, pose.lift);
    // A short sharper cuff anchors the diffuse calf to the shoe.
    const cuff = { x: ankle.x + (knee.x - ankle.x) * .22, y: ankle.y + (knee.y - ankle.y) * .22 };
    feet.save();
    feet.filter = `blur(${(2.1 + pose.lift * 3.5) * scale * pixelRatio}px)`;
    limb(feet, ankle, cuff, 18, 22, .54, 0);
    const contact = project(side * 14, pose.forward, pose.lift * FOOT_LIFT);
    feet.filter = `blur(${(.55 + pose.lift * 2.8 + Math.max(0, pose.roll) * .4) * scale * pixelRatio}px)`;
    sole(feet, contact, side, walker.angle, pose);
    feet.restore();
  }
  for (const { context: c } of layers) c.restore();
}

function render() {
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.fillStyle = '#f4f4f3';
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width * .46, height * .42, 0, width * .5, height * .5, Math.max(width, height) * .7);
  glow.addColorStop(0, '#ffffff');
  glow.addColorStop(1, '#efefee');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  for (const { context: c } of layers) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }
  personButtons.forEach((target, i) => { if (i >= settings.people) target.hidden = true; });
  if (selected >= settings.people) dismissThought();
  walkers.slice(0, settings.people).forEach(renderWalker);
  const size = sceneScale();
  for (let i = 0; i < layers.length; i++) {
    ctx.filter = `blur(${[14 * settings.blur * size, 7.2 * settings.blur * size, .35 * size][i] * pixelRatio}px)`;
    ctx.drawImage(layers[i].element, 0, 0, width, height);
  }
  ctx.filter = 'none';
  positionThought();
}

function tick(now: number) {
  const dt = Math.min((now - previous) / 1000, .05);
  previous = now;
  if (!document.hidden) {
    if (selected >= 0 && !thought.matches(':hover, :focus-within') && !personButtons[selected].matches(':focus-visible')) {
      selectionRemaining -= dt;
      if (selectionRemaining <= 0) dismissThought();
    }
    if (!paused) {
      elapsed += dt * settings.speed;
      walkerTimes.forEach((_, i) => {
        const targetSpeed = i === selected ? .24 : 1;
        walkerSpeeds[i] += (targetSpeed - walkerSpeeds[i]) * (1 - Math.exp(-dt * 4));
        walkerTimes[i] += dt * settings.speed * walkerSpeeds[i];
      });
      render();
    }
  }
  frame = requestAnimationFrame(tick);
}

function updatePlayback() {
  button.setAttribute('aria-pressed', String(paused));
  button.setAttribute('aria-label', paused ? '애니메이션 재생' : '애니메이션 일시 정지');
}
function togglePlayback() { paused = !paused; updatePlayback(); }
button.addEventListener('click', togglePlayback);
window.addEventListener('keydown', event => {
  if (event.code === 'Space' && event.target === document.body) { event.preventDefault(); togglePlayback(); }
});
reducedMotion.addEventListener('change', event => { paused = event.matches; updatePlayback(); });
window.addEventListener('resize', resize);
window.addEventListener('pagehide', () => cancelAnimationFrame(frame));
window.addEventListener('pageshow', event => {
  if (event.persisted) { previous = performance.now(); frame = requestAnimationFrame(tick); }
});
if (query.has('debug')) {
  const gui = new GUI({ title: 'Behind Glass' });
  gui.add(settings, 'speed', .1, 2, .05);
  gui.add(settings, 'blur', .2, 2, .05).onChange(render);
  gui.add(settings, 'scale', .5, 1.8, .05).onChange(render);
  gui.add(settings, 'people', 1, 6, 1).onChange(render);
  gui.add({ time: elapsed }, 'time', 0, 20, .01).onChange((time: number) => {
    paused = true; elapsed = time; walkerTimes.fill(time); updatePlayback(); render();
  });
}
updatePlayback();
resize();
frame = requestAnimationFrame(tick);
