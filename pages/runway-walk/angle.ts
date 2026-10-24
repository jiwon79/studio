import data from './angles.json';
import { buildBlocks, chooseBlock, type AngleFrame } from './angle-match';

const frames: AngleFrame[] = data.frames;
const blocks = buildBlocks(frames, data.holdFrames);
const canvas = document.querySelector<HTMLCanvasElement>('#person')!;
const context = canvas.getContext('2d')!;
const angle = document.querySelector<HTMLInputElement>('#angle')!;
const direction = document.querySelector<HTMLOutputElement>('#direction')!;
const loading = document.querySelector<HTMLParagraphElement>('#loading')!;
const play = document.querySelector<HTMLButtonElement>('#play')!;
const save = document.querySelector<HTMLButtonElement>('#save')!;
const reset = document.querySelector<HTMLButtonElement>('#reset')!;
const presets = document.querySelector<HTMLDivElement>('#presets')!;
const minYaw = Math.min(...blocks.map(b => b.yaw));
const maxYaw = Math.floor(Math.max(...blocks.map(b => b.yaw)));
angle.min = String(minYaw); angle.max = String(maxYaw);
const storageKey = 'runway-walk-direction-v1';
const clamp = (value: number) => Math.max(minYaw, Math.min(maxYaw, value));
let target = 0, bookmarks: number[] = [];
try {
  const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
  if (Number.isFinite(stored.angle)) target = clamp(stored.angle);
  if (Array.isArray(stored.bookmarks)) bookmarks = [...new Set<number>(stored.bookmarks.filter((v: unknown) => typeof v === 'number' && Number.isFinite(v)).map(clamp))].slice(0, 5);
} catch { /* Storage may be unavailable; the artwork still works. */ }
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify({ angle: target, bookmarks })); } catch { /* Optional local persistence. */ }
}
function label(value: number) { return value === 0 ? '정면' : `${value < 0 ? '왼쪽' : '오른쪽'} ${Math.abs(value)}°`; }
let images: HTMLImageElement[] = [];
let ready = false;
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let phase = 0, clock = 0, offset = 0;
let block = chooseBlock(blocks, target, phase);
let recent: string[] = [];
let lastTime = 0, carry = 0;
function draw() {
  const row = frames[block.start + offset];
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(images[row.atlas], (row.tile % data.columns) * data.tileWidth, Math.floor(row.tile / data.columns) * data.tileHeight, data.tileWidth, data.tileHeight, 0, 0, canvas.width, canvas.height);
  canvas.dataset.sourceFrame = String(row.sourceFrame);
  canvas.dataset.clip = row.clip;
  canvas.dataset.actualYaw = String(row.yaw);
  canvas.dataset.phase = String(phase);
  canvas.dataset.clock = String(clock);
}
function pick() {
  block = chooseBlock(blocks, target, phase, recent);
  recent = [block.clip, ...recent].slice(0, 2);
  offset = 0;
}
function setAngle(value: number) {
  target = Math.round(clamp(value)); angle.value = String(target); direction.value = label(target);
  for (const button of presets.querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.angle) === target));
  if (ready && !playing) { pick(); draw(); }
}
function renderPresets() {
  presets.replaceChildren();
  for (const value of bookmarks) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = label(value); button.dataset.angle = String(value);
    button.setAttribute('aria-pressed', String(value === target));
    button.addEventListener('click', () => { setAngle(value); persist(); });
    presets.append(button);
  }
}
function playbackState() {
  play.textContent = playing ? 'Ⅱ' : '▶'; play.setAttribute('aria-label', playing ? '일시정지' : '재생');
}
angle.addEventListener('input', () => setAngle(Number(angle.value)));
angle.addEventListener('change', persist);
reset.addEventListener('click', () => { setAngle(0); persist(); });
save.addEventListener('click', () => {
  bookmarks = [target, ...bookmarks.filter(v => v !== target)].slice(0, 5); renderPresets(); persist();
});
play.addEventListener('click', () => { playing = !playing; carry = 0; lastTime = 0; playbackState(); });
let drag: { id: number; x: number; start: number } | undefined;
canvas.addEventListener('pointerdown', event => {
  if (!ready) return;
  drag = { id: event.pointerId, x: event.clientX, start: target };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!drag || drag.id !== event.pointerId) return;
  setAngle(drag.start + (event.clientX - drag.x) / Math.max(220, canvas.clientWidth) * (maxYaw - minYaw));
});
function endDrag(event: PointerEvent) { if (drag?.id === event.pointerId) { drag = undefined; persist(); } }
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('lostpointercapture', () => { drag = undefined; });
canvas.addEventListener('keydown', event => {
  if (!ready) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); setAngle(target + (event.key === 'ArrowRight' ? 5 : -5)); persist();
  } else if (event.key === 'Home') { event.preventDefault(); setAngle(0); persist(); }
});
document.addEventListener('visibilitychange', () => { lastTime = 0; carry = 0; });
function tick(time: number) {
  if (ready && playing && !document.hidden) {
    carry += lastTime ? Math.min((time - lastTime) / 1000, 0.12) : 0;
    while (carry >= 1 / data.fps) {
      carry -= 1 / data.fps; clock++; phase = (phase + 1 / 30) % 1;
      offset++;
      if (offset === data.holdFrames) pick();
      draw();
    }
  }
  lastTime = time;
  requestAnimationFrame(tick);
}
async function load() {
  try {
    let completed = 0;
    images = await Promise.all(data.atlases.map(filename => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => { completed++; loading.textContent = `여러 몸의 걸음을 모으는 중… ${Math.round(completed / data.atlases.length * 100)}%`; resolve(image); };
      image.onerror = () => reject(new Error(`Atlas failed: ${filename}`));
      image.src = new URL(`./media/angles/${filename}`, import.meta.url).href;
    })));
    ready = true; pick(); draw(); loading.hidden = true;
    for (const element of [angle, play, save, reset]) element.disabled = false;
    requestAnimationFrame(tick);
  } catch { loading.textContent = '영상을 불러오지 못했어요. 새로고침해 주세요.'; }
}
setAngle(target); renderPresets(); playbackState(); void load();
