import GUI from 'lil-gui';
import './style.css';
import { footPose, wrapPosition } from './motion';

const canvas = document.querySelector('canvas')!;
const ctx = canvas.getContext('2d', { alpha: false })!;
const button = document.querySelector<HTMLButtonElement>('.playback')!;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const settings = { speed: 1, blur: 1, scale: 1, people: 4 };
let width = 0;
let height = 0;
let pixelRatio = 1;
let elapsed = 2.3;
let previous = 0;
let paused = reducedMotion.matches;
let frame = 0;

const layers = Array.from({ length: 3 }, () => {
  const element = document.createElement('canvas');
  return { element, context: element.getContext('2d')! };
});
// Distinct routes, headings and cadences avoid a marching, synchronized crowd.
// Motion reference: https://x.com/nusretuzman/status/2114480094840570247
// All shapes and motion are procedural; no source video or imagery is shipped.
const walkers = [
  { x: .12, y: .24, angle: 1.10, period: 1.20, phase: .12, size: .98 },
  { x: .80, y: .54, angle: 3.55, period: 1.32, phase: .67, size: 1.06 },
  { x: .44, y: .92, angle: -.64, period: 1.12, phase: .35, size: .92 },
  { x: .64, y: -.12, angle: 2.60, period: 1.38, phase: .82, size: 1.02 },
  { x: .20, y: .78, angle: -2.40, period: 1.27, phase: .48, size: .96 },
  { x: .92, y: .15, angle: .40, period: 1.17, phase: .91, size: 1.04 },
];

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

function capsule(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, thickness: number, color: string) {
  c.strokeStyle = color;
  c.lineWidth = thickness;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
}

function sole(c: CanvasRenderingContext2D, forward: number, side: number, lift: number, roll: number, swing: number) {
  c.save();
  c.translate(side, -forward - lift * 10);
  c.rotate(side * .005 + swing * .07);
  // The heel narrows into the arch; the toe box is deliberately asymmetric.
  c.scale(1 - lift * .09, 1 - roll * .19);
  c.fillStyle = `rgba(13,14,16,${.96 - lift * .24})`;
  c.beginPath();
  c.moveTo(-7, 19);
  c.bezierCurveTo(-11, 15, -9, 7, -10, 1);
  c.bezierCurveTo(-13, -9, -12, -20, -6, -24);
  c.bezierCurveTo(0, -28, 11, -25, 12, -17);
  c.bezierCurveTo(14, -9, 9, 1, 8, 8);
  c.bezierCurveTo(8, 18, 5, 22, -1, 22);
  c.bezierCurveTo(-4, 22, -6, 21, -7, 19);
  c.fill();
  c.restore();
}

function sceneScale() {
  return Math.max(.65, Math.min(width / 1150, height / 760, 1.35)) * settings.scale;
}

function renderWalker(walker: typeof walkers[number]) {
  const scale = sceneScale() * walker.size;
  const stride = 88;
  const cycle = elapsed / walker.period + walker.phase;
  const distance = elapsed * stride / walker.period * scale;
  const x = wrapPosition(walker.x * width + Math.sin(walker.angle) * distance, width, 180 * scale);
  const y = wrapPosition(walker.y * height - Math.cos(walker.angle) * distance, height, 180 * scale);
  const sway = Math.sin(cycle * Math.PI * 2) * 3;
  for (const { context: c } of layers) {
    c.save();
    c.translate(x, y);
    c.rotate(walker.angle);
    c.scale(scale, scale);
  }
  const body = layers[0].context;
  const legs = layers[1].context;
  const feet = layers[2].context;
  // Height above the glass becomes both displacement and diffusion.
  // A receding torso joins the two legs, rather than leaving isolated footprints.
  capsule(body, sway, 37, sway * .7, 88, 41, 'rgba(30,31,33,.24)');
  capsule(body, -17 + sway, 50, 18 + sway, 50, 29, 'rgba(27,28,30,.28)');
  body.fillStyle = 'rgba(30,31,33,.16)';
  body.beginPath();
  body.ellipse(sway, 111, 14, 18, 0, 0, Math.PI * 2);
  body.fill();
  for (const side of [-1, 1]) {
    const pose = footPose(cycle + (side === 1 ? .5 : 0), stride);
    const ankleX = side * 14;
    const ankleY = -pose.forward + 7 - pose.lift * 10;
    const kneeX = side * 13 + sway;
    const kneeY = (ankleY + 44) * .5 + 10;
    capsule(body, side * 12 + sway, 49, kneeX, kneeY, 24, 'rgba(21,22,24,.42)');
    capsule(legs, kneeX, kneeY, ankleX, ankleY, 17, `rgba(22,23,26,${.55 - pose.lift * .13})`);
    capsule(legs, ankleX, ankleY, ankleX, ankleY + 10, 17, 'rgba(16,17,19,.56)');
    feet.save();
    feet.filter = `blur(${1 + pose.lift * 3}px)`;
    sole(feet, pose.forward, ankleX, pose.lift, pose.roll, Math.sin(cycle * Math.PI * 2));
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
  walkers.slice(0, settings.people).forEach(renderWalker);
  const size = sceneScale();
  for (let i = 0; i < layers.length; i++) {
    ctx.filter = `blur(${[17 * settings.blur * size, 7 * settings.blur * size, .55 * size][i]}px)`;
    ctx.drawImage(layers[i].element, 0, 0, width, height);
  }
  ctx.filter = 'none';
}

function tick(now: number) {
  if (!paused && !document.hidden) elapsed += Math.min((now - previous) / 1000, .05) * settings.speed;
  previous = now;
  if (!paused && !document.hidden) render();
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
if (new URLSearchParams(location.search).has('debug')) {
  const gui = new GUI({ title: 'Behind Glass' });
  gui.add(settings, 'speed', .1, 2, .05);
  gui.add(settings, 'blur', .2, 2, .05).onChange(render);
  gui.add(settings, 'scale', .5, 1.8, .05).onChange(render);
  gui.add(settings, 'people', 1, 6, 1).onChange(render);
}
updatePlayback();
resize();
frame = requestAnimationFrame(tick);
