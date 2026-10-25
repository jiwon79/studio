import data from './angles.json';
import { AtlasPool } from './atlas-pool';
import { buildBlocks, chooseBlock, type AngleFrame } from './angle-match';

const frames: AngleFrame[] = data.frames;
const blocks = buildBlocks(frames, data.holdFrames);
const surface = document.querySelector<HTMLElement>('#surface')!;
const canvas = document.querySelector<HTMLCanvasElement>('#person')!;
const context = canvas.getContext('2d')!;
const direction = document.querySelector<HTMLOutputElement>('#direction')!;
const status = document.querySelector<HTMLElement>('#status')!;
const [minYaw, maxYaw] = data.yawRange;
surface.setAttribute('aria-valuemin', String(minYaw));
surface.setAttribute('aria-valuemax', String(maxYaw));
const storageKey = 'runway-walk-direction-v1';
const clamp = (value: number) => Math.max(minYaw, Math.min(maxYaw, value));
let target = 0, saved: Record<string, unknown> = {};
try {
  const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
  if (stored && typeof stored === 'object') saved = stored;
  if (typeof saved.angle === 'number' && Number.isFinite(saved.angle)) target = clamp(saved.angle);
} catch { /* Storage is optional. */ }
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify({ ...saved, angle: target })); } catch { /* Optional local persistence. */ }
}
function label(value: number) { return `${value < 0 ? '−' : value > 0 ? '+' : ''}${Math.abs(value)}°`; }

// Fetch only visible and next pages. Keep compressed pages small as well as decoded images.
const compressed = new Map<number, Blob>();
const images = new AtlasPool(async index => {
  let blob = compressed.get(index);
  if (blob) compressed.delete(index);
  else {
    const url = new URL(`./media/angles/${data.atlases[index]}?v=${data.assetVersion}`, import.meta.url).href;
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Atlas failed: ${response.status}`);
        blob = await response.blob();
        break;
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise(resolve => window.setTimeout(resolve, attempt === 0 ? 250 : 750));
      }
    }
  }
  compressed.set(index, blob);
  while (compressed.size > 24) compressed.delete(compressed.keys().next().value!);
  return createImageBitmap(blob);
}, 5);
context.imageSmoothingQuality = 'high';
let switching = false, repick = false;
let ready = false;
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let phase = 0, clock = 0, offset = 0;
let block = chooseBlock(blocks, target, phase);
let recent: string[] = [];
let lastTime = 0, carry = 0;
function draw() {
  const row = frames[block.start + offset];
  const image = images.get(row.atlas);
  if (!image) { void prepare(block).then(draw).catch(failed); return; }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, (row.tile % data.columns) * data.tileWidth, Math.floor(row.tile / data.columns) * data.tileHeight, data.tileWidth, data.tileHeight, 0, 0, canvas.width, canvas.height);
  canvas.dataset.sourceFrame = String(row.sourceFrame);
  canvas.dataset.clip = row.clip;
  canvas.dataset.actualYaw = String(row.yaw);
  canvas.dataset.phase = String(phase);
  canvas.dataset.clock = String(clock);
  canvas.dataset.decodedPages = String(images.size);
  canvas.dataset.compressedPages = String(compressed.size);
}
async function prepare(candidate: typeof block) {
  const pages = new Set(frames.slice(candidate.start, candidate.start + data.holdFrames).map(row => row.atlas));
  await Promise.all([...pages].map(index => images.load(index)));
}
function warmNext() {
  const last = frames[block.start + data.holdFrames - 1];
  const candidate = chooseBlock(blocks, target, (phase + (data.holdFrames - offset) / 30) % 1, recent, last.gait, last.gaitVelocity);
  void prepare(candidate).catch(() => { /* Foreground decoding retries a failed prefetch. */ });
}
function failed() {
  playing = false;
  surface.dataset.playing = 'false';
  surface.setAttribute('aria-busy', 'false');
  status.textContent = '프레임을 불러오지 못했어요. 새로고침해 주세요.';
}
async function pick() {
  if (switching) { repick = true; return; }
  switching = true;
  const requested = target;
  const last = ready ? frames[block.start + Math.min(offset, data.holdFrames - 1)] : undefined;
  const candidate = chooseBlock(blocks, requested, phase, recent, last?.gait, last?.gaitVelocity);
  try {
    await prepare(candidate);
    // A drag can change direction while a network page is arriving.
    if (requested !== target) { repick = true; return; }
    block = candidate;
    recent = [block.look ?? block.clip, ...recent].slice(0, 4);
    offset = 0;
    draw();
    warmNext();
  } catch { failed(); }
  finally {
    switching = false;
    if (repick) { repick = false; void pick(); }
  }
}
function setAngle(value: number) {
  const next = Math.round(clamp(value));
  const changed = next !== target;
  target = next;
  direction.value = label(target);
  surface.setAttribute('aria-valuenow', String(target));
  surface.setAttribute('aria-valuetext', label(target));
  if (ready && changed) void pick();
}
let drag: { id: number; x: number; start: number } | undefined;
surface.addEventListener('pointerdown', event => {
  if (!ready || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
  drag = { id: event.pointerId, x: event.clientX, start: target };
  surface.dataset.dragging = 'true';
  surface.setPointerCapture(event.pointerId);
});
surface.addEventListener('pointermove', event => {
  if (!drag || drag.id !== event.pointerId) return;
  const distance = Math.min(640, Math.max(320, surface.clientWidth * .85));
  setAngle(drag.start + (event.clientX - drag.x) / distance * (maxYaw - minYaw));
});
function endDrag(event: PointerEvent) {
  if (drag?.id !== event.pointerId) return;
  drag = undefined;
  surface.dataset.dragging = 'false';
  persist();
}
surface.addEventListener('pointerup', endDrag);
surface.addEventListener('pointercancel', endDrag);
surface.addEventListener('lostpointercapture', endDrag);
surface.addEventListener('keydown', event => {
  if (!ready) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    setAngle(target + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 1 : 5));
    persist();
  } else if (event.key === 'Home') {
    event.preventDefault(); setAngle(0); persist();
  } else if (event.code === 'Space') {
    event.preventDefault(); playing = !playing; carry = 0; lastTime = 0;
    surface.dataset.playing = String(playing);
    status.textContent = playing ? '재생' : '일시정지';
  }
});
window.addEventListener('blur', () => { drag = undefined; surface.dataset.dragging = 'false'; });
document.addEventListener('visibilitychange', () => { lastTime = 0; carry = 0; });
function tick(time: number) {
  if (ready && playing && !switching && !document.hidden) {
    carry += lastTime ? Math.min((time - lastTime) / 1000, 0.12) : 0;
    while (carry >= 1 / data.fps) {
      carry -= 1 / data.fps; clock++; phase = (phase + 1 / 30) % 1;
      offset++;
      if (offset === data.holdFrames) { void pick(); break; }
      draw();
    }
  }
  lastTime = time;
  requestAnimationFrame(tick);
}
async function load() {
  try {
    await pick();
    if (!images.get(frames[block.start].atlas)) throw new Error('Initial frame decode failed');
    ready = true;
    surface.setAttribute('aria-busy', 'false');
    surface.dataset.playing = String(playing);
    requestAnimationFrame(tick);
  } catch { failed(); }
}
setAngle(target); void load();
