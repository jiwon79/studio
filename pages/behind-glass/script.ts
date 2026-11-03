import { settleSpeed, STOP_RESPONSE } from './settling';
import { advanceSway } from './drag-physics';
import { positionBelowFeet } from './layout';
import { biomechanicalLeg, BIOMECHANICAL_STRIDE } from './biomechanics';
import GUI from 'lil-gui';
import './style.css';
import { footPose, legPose, pelvisHeight, FOOT_LIFT, STRIDE, RUN_STRIDE, runningFootPose, wrapPosition, type FootPose } from './motion';

const canvas = document.querySelector('canvas')!;
const ctx = canvas.getContext('2d', { alpha: false })!;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const settings = { speed: 1, blur: 1, scale: 1, people: 5 };
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
// Shapes are procedural; walking uses the OpenSim clip. No reference video or imagery is shipped.
const walkers = [
  { x: .05, y: .30, angle: 1.67, period: 1.20, phase: .12, size: .98 },
  { x: .86, y: .79, angle: .08, period: 1.32, phase: .67, size: 1.06 },
  { x: .43, y: .78, angle: -1.67, period: 1.12, phase: .35, size: .98 },
  { x: .65, y: .24, angle: -.08, period: 1.38, phase: .82, size: 1.02 },
  { x: .08, y: .55, angle: 1.45, period: .82, phase: .48, size: .96 },
  { x: .92, y: .15, angle: .40, period: 1.17, phase: .91, size: 1.04 },
];

const stories = [
  { destination: '집으로 가는 사람', thought: '집에 가면 바로 누워야지.' },
  { destination: '소개팅하러 가는 사람', thought: '만나면 무슨 말부터 하지.' },
  { destination: '퇴근하는 사람', thought: '내일 일은 내일 생각하자.' },
  { destination: '그냥 걷는 사람', thought: '목적지가 없어도 걷는 건 좋다.' },
  { destination: '뛰어가는 사람', thought: '아직 늦지 않았을 거야.' },
  { destination: '편의점 가는 사람', thought: '아이스크림만 사서 나와야지.' },
];
const people = document.querySelector<HTMLDivElement>('.people')!;
const thought = document.querySelector<HTMLElement>('.thought')!;
const destination = document.querySelector<HTMLElement>('.destination')!;
const sentence = document.querySelector<HTMLElement>('.sentence')!;
const closeThought = document.querySelector<HTMLButtonElement>('.thought-close')!;
const walkerTimes = walkers.map(() => elapsed);
const walkerSpeeds = walkers.map(() => 1);
const anchors: { x: number; y: number; scale: number }[] = [];
const footAnchors: { x: number; y: number }[] = [];
let holdTimer = 0;
const dragOffsets = walkers.map(() => ({ x: 0, y: 0 }));
const dragLifts = walkers.map(() => 0);
const dragSways = walkers.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
const previousDragOffsets = walkers.map(() => ({ x: 0, y: 0 }));
let drag: { index: number; pointer: number; x: number; y: number; anchorX: number; anchorY: number; offsetX: number; offsetY: number; active: boolean } | null = null;
let suppressClickUntil = 0;
let selected = -1;
let needsThoughtPlacement = false;
let selectionRemaining = 0;
const personButtons = walkers.map((_, index) => {
  const target = document.createElement('button');
  target.type = 'button';
  target.className = 'person';
  target.setAttribute('aria-label', `${stories[index].destination}의 생각 보기`);
  target.setAttribute('aria-expanded', 'false');
  target.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || drag) return;
    const anchor = anchors[index];
    drag = { index, pointer: event.pointerId, x: event.clientX, y: event.clientY, anchorX: anchor.x, anchorY: anchor.y, offsetX: dragOffsets[index].x, offsetY: dragOffsets[index].y, active: false };
    target.setPointerCapture(event.pointerId);
    holdTimer = window.setTimeout(() => {
      if (!drag || drag.index !== index || drag.active) return;
      drag.active = true; dismissThought(); target.classList.add('dragging');
      if (paused) { dragLifts[index] = 1; render(); }
    }, 450);
  });
  target.addEventListener('pointermove', event => {
    if (!drag || drag.index !== index || drag.pointer !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.active && Math.hypot(dx, dy) < 6) return;
    if (!drag.active) { drag.active = true; dismissThought(); target.classList.add('dragging'); }
    event.preventDefault();
    const anchor = anchors[index];
    const x = Math.max(40, Math.min(width - 40, drag.anchorX + dx));
    const y = Math.max(100 * anchor.scale, Math.min(height - 45, drag.anchorY + dy));
    dragOffsets[index] = { x: drag.offsetX + x - drag.anchorX, y: drag.offsetY + y - drag.anchorY };
    if (paused) dragLifts[index] = 1;
    render();
  });
  const finishDrag = (event: PointerEvent) => {
    if (!drag || drag.index !== index || drag.pointer !== event.pointerId) return;
    clearTimeout(holdTimer);
    if (drag.active) suppressClickUntil = performance.now() + 350;
    drag = null;
    target.classList.remove('dragging');
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    if (paused) { dragLifts[index] = 0; render(); }
  };
  target.addEventListener('pointerup', finishDrag);
  target.addEventListener('pointercancel', finishDrag);
  target.addEventListener('lostpointercapture', finishDrag);
  target.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil && event.detail !== 0) return;
    if (selected === index) dismissThought();
    else {
      selected = index;
      needsThoughtPlacement = true;
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
  if (selected < 0 || !needsThoughtPlacement) return;
  const anchor = anchors[selected];
  if (!anchor) return;
  const walker = walkers[selected];
  const remaining = paused ? 0 : walkerSpeeds[selected] / STOP_RESPONSE * settings.speed;
  const stride = selected === 4 ? RUN_STRIDE : BIOMECHANICAL_STRIDE;
  const travel = remaining * stride / walker.period * anchor.scale;
  // Pin the card below the predicted resting soles, without following the brake.
  const feet = walkerSpeeds[selected] > 0 ? {
    x: anchor.x + Math.sin(walker.angle) * travel,
    y: anchor.y - Math.cos(walker.angle) * travel + (Math.abs(Math.cos(walker.angle))*23 + Math.abs(Math.sin(walker.angle))*13)*anchor.scale,
  } : footAnchors[selected] ?? anchor;
  const position = positionBelowFeet(feet, thought.offsetWidth, thought.offsetHeight, { width, height });
  thought.style.transform = `translate(${position.x}px, ${position.y}px)`;
  needsThoughtPlacement = false;
}

function resize() {
  needsThoughtPlacement = true;
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

function sole(c: CanvasRenderingContext2D, position: Point, side: number, angle: number, pose: FootPose, centered = false) {
  c.save();
  c.translate(position.x, position.y);
  c.rotate(angle + side * .035);
  // Roll around the toe, so the heel rises without dragging the contact point.
  c.translate(0, centered ? 0 : -23);
  c.scale(1 - pose.lift * .04, Math.cos(pose.roll));
  c.translate(0, centered ? 0 : 23);
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
  const { x, y, scale } = anchors[index];
  const cycle = time / walker.period + walker.phase;
  const gaitKind = index === 4 ? 'run' : 'walk';
  const useBiomechanics = gaitKind === 'walk';
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
    x: cos * side + sin * forward + riseX * (elevation + dragLifts[index] * 28),
    y: sin * side - cos * forward + riseY * (elevation + dragLifts[index] * 28),
  });
  for (const { context: c } of layers) {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
  }
  const far = layers[0].context;
  const legs = layers[1].context;
  const feet = layers[2].context;
  const walking = walkerSpeeds[index];
  const hipHeight = 115 + (pelvisHeight(cycle, gaitKind) - 115) * walking;
  const footPositions: { x: number; bottom: number }[] = [];
  for (const side of [-1, 1]) {
    const legCycle = cycle + (side === 1 ? .5 : 0);
    const gait = gaitKind === 'run' ? runningFootPose(legCycle) : footPose(legCycle, STRIDE);
    // Settle onto two flat feet instead of freezing a foot in mid-swing.
    let pose = { forward: gait.forward * walking, lift: gait.lift * walking, roll: gait.roll * walking };
    const joints = legPose(pose, hipHeight);
    let ankle = project(side * 14, joints.ankle.forward, joints.ankle.height);
    let knee = project(side * 12, joints.knee.forward, joints.knee.height);
    let hip = project(side * 10, joints.hip.forward, joints.hip.height);
    let contact = project(side * 14, pose.forward, pose.lift * FOOT_LIFT);
    if (useBiomechanics) {
      const motion = biomechanicalLeg(cycle, side);
      const stand = legPose({ forward: 0, lift: 0, roll: 0 }, 115);
      const blend = (moving: Point, resting: Point): Point => ({
        x: resting.x + (moving.x - resting.x) * walking,
        y: resting.y + (moving.y - resting.y) * walking,
      });
      const projectBody = (p: typeof motion.hip) => project(p.lateral, p.forward, p.height);
      ankle = blend(projectBody(motion.ankle), project(side*14, 0, stand.ankle.height));
      knee = blend(projectBody(motion.knee), project(side*12, stand.knee.forward, stand.knee.height));
      hip = blend(projectBody(motion.hip), project(side*10, 0, stand.hip.height));
      contact = blend(projectBody(motion.contact), project(side*14, 0, 0));
      pose = { forward: motion.contact.forward * walking, lift: motion.lift * walking, roll: motion.roll * walking };
    }
    const lifted = dragLifts[index];
    const sway = dragSways[index];
    // Rotate the suspended leg about the hip so the projected bones keep length.
    const swing = Math.atan2(sway.x + sway.y * .35, 110 * scale) * lifted;
    const rotate = (p: Point): Point => {
      const dx = p.x - hip.x, dy = p.y - hip.y;
      return { x: hip.x + dx * Math.cos(swing) + dy * Math.sin(swing), y: hip.y - dx * Math.sin(swing) + dy * Math.cos(swing) };
    };
    knee = rotate(knee); ankle = rotate(ankle); contact = rotate(contact);
    // With no ground support, the ankle relaxes and the toe hangs downward.
    const turn = Math.atan2(Math.sin(Math.PI - walker.angle), Math.cos(Math.PI - walker.angle));
    const shoeAngle = walker.angle + turn * lifted * .85 + swing;
    const hangingContact = { x: ankle.x + Math.sin(shoeAngle) * 14, y: ankle.y - Math.cos(shoeAngle) * 14 };
    contact = { x: contact.x + (hangingContact.x - contact.x) * lifted, y: contact.y + (hangingContact.y - contact.y) * lifted };
    pose.roll = pose.roll * (1 - lifted) + .85 * lifted;
    // Only the legs survive the frosted surface. The upper thigh fades to zero;
    // there is no separate head/shoulder blob extending beyond it.
    const diffuseEnd = { x: hip.x + riseX * 32, y: hip.y + riseY * 32 };
    limb(far, knee, diffuseEnd, 32, 46, .26, 0);
    legSilhouette(legs, ankle, knee, hip, pose.lift);
    // A short sharper cuff anchors the diffuse calf to the shoe.
    const cuff = { x: ankle.x + (knee.x - ankle.x) * .22, y: ankle.y + (knee.y - ankle.y) * .22 };
    pose.lift = Math.max(pose.lift, dragLifts[index] * .85);
    feet.save();
    feet.filter = `blur(${(2.1 + pose.lift * 3.5) * scale * pixelRatio}px)`;
    limb(feet, ankle, cuff, 18, 22, .54, 0);
    feet.filter = `blur(${(.55 + pose.lift * 2.8 + Math.max(0, pose.roll) * .4) * scale * pixelRatio}px)`;
    sole(feet, contact, side, shoeAngle, pose, useBiomechanics || lifted > .01);
    feet.restore();
    footPositions.push({ x: contact.x, bottom: contact.y + Math.abs(Math.cos(shoeAngle)) * 23 * Math.cos(pose.roll) + Math.abs(Math.sin(shoeAngle)) * 13 });
  }
  footAnchors[index] = { x: x + (footPositions[0].x + footPositions[1].x) / 2 * scale, y: y + Math.max(...footPositions.map(p => p.bottom)) * scale };
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
  const positions = walkers.slice(0, settings.people).map((walker, index) => {
    const scale = sceneScale() * walker.size;
    const stride = index === 4 ? RUN_STRIDE : BIOMECHANICAL_STRIDE;
    const distance = walkerTimes[index] * stride / walker.period * scale;
    return {
      x: wrapPosition(walker.x * width + Math.sin(walker.angle) * distance + dragOffsets[index].x, width, 180 * scale),
      y: wrapPosition(walker.y * height - Math.cos(walker.angle) * distance + dragOffsets[index].y, height, 180 * scale), scale,
    };
  });
  positions.forEach((p, i) => { anchors[i] = p; });
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
        const offset = dragOffsets[i];
        const last = previousDragOffsets[i];
        const velocity = { x: (offset.x - last.x) / Math.max(dt, .001), y: (offset.y - last.y) / Math.max(dt, .001) };
        advanceSway(dragSways[i], velocity, dt);
        previousDragOffsets[i] = { ...offset };
        const held = drag?.active === true && drag.index === i;
        dragLifts[i] += ((held ? 1 : 0) - dragLifts[i]) * (1 - Math.exp(-dt * 12));
        if (dragLifts[i] < .001) dragLifts[i] = 0;
        const targetSpeed = i === selected || drag?.index === i || dragLifts[i] > .05 ? 0 : 1;
        walkerSpeeds[i] = settleSpeed(walkerSpeeds[i], targetSpeed, dt);
        if (!held) walkerTimes[i] += dt * settings.speed * walkerSpeeds[i];
      });
      render();
    }
  }
  frame = requestAnimationFrame(tick);
}

reducedMotion.addEventListener('change', event => { paused = event.matches; });
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
    paused = true; elapsed = time; walkerTimes.fill(time); render();
  });
}
resize();
frame = requestAnimationFrame(tick);
