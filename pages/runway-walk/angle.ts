import data from './angles.json';
import previews from './drag.json';
import { AtlasPool } from './atlas-pool';
import { ANGLE_STEP, snapYaw } from './direction-step';
import type { AngleFrame } from './angle-match';
import {WalkCoverageError,rebaseWalkState} from './walk-sequencer';
import {clockPhase,createWalkState} from './reference-clock';
import { ReferenceSequencer, type ReferenceCut } from './reference-sequencer';
import referenceMatches from './reference-matches.json';

const frames: AngleFrame[] = data.frames;
const sequencer = new ReferenceSequencer(frames, data.holdFrames);
const frameIndices=new Map(frames.map((frame,index)=>[frame,index]));
const surface = document.querySelector<HTMLElement>('#surface')!;
const canvas = document.querySelector<HTMLCanvasElement>('#person')!;
const context = canvas.getContext('2d')!;
const direction = document.querySelector<HTMLOutputElement>('#direction')!;
const status = document.querySelector<HTMLElement>('#status')!;
const loading = document.querySelector<HTMLElement>('#loading')!;
const [minYaw, maxYaw] = data.yawRange;
surface.setAttribute('aria-valuemin', String(minYaw));
surface.setAttribute('aria-valuemax', String(maxYaw));
const storageKey = 'runway-walk-direction-v1';
let target = 0, saved: Record<string, unknown> = {};
try {
  const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
  if (stored && typeof stored === 'object') saved = stored;
  if (typeof saved.angle === 'number' && Number.isFinite(saved.angle)) target = snapYaw(saved.angle, minYaw, maxYaw);
} catch { /* Storage is optional. */ }
const linkedAngle = new URLSearchParams(location.search).get('angle');
if (linkedAngle?.trim() && Number.isFinite(Number(linkedAngle))) target = snapYaw(Number(linkedAngle), minYaw, maxYaw);
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify({ ...saved, angle: target })); } catch { /* Optional local persistence. */ }
}
function label(value: number) { return `${value < 0 ? '−' : value > 0 ? '+' : ''}${Math.abs(value)}°`; }

async function fetchPage(name: string, version: string) {
  const url = new URL(`./media/angles/${name}`, import.meta.url);
  url.searchParams.set('v', version);
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Atlas failed: ${response.status}`);
      return await response.blob();
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => window.setTimeout(resolve, attempt === 0 ? 250 : 750));
    }
  }
}
// Fetch every photograph before playback. Keeping WebP blobs is substantially
// smaller than retaining all 4.2 GB of decoded HD pixels on a phone.
const compressed = new Map<number, Blob>();
const images = new AtlasPool(async index => {
  const blob = compressed.get(index);
  if (!blob) throw new Error('Playback started before the complete download');
  return createImageBitmap(blob);
}, 12);
// Trimmed original-resolution pixels cover every snapped view before input is
// enabled. Dragging needs neither a decode nor a low-resolution substitute.
const dragImages: ImageBitmap[] = [];
let downloaded = 0;
function downloadedPage() {
  downloaded++;
  loading.style.setProperty('--loaded', `${downloaded / (data.atlases.length + previews.atlases.length) * 100}%`);
  surface.dataset.loadedPages = String(downloaded);
}
async function loadPhotographs() {
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < data.atlases.length) {
      const index = next++;
      compressed.set(index, await fetchPage(data.atlases[index], data.assetVersion));
      downloadedPage();
    }
  }));
}
async function loadPreviews() {
  let next = 0;
  await Promise.all([0, 1].map(async () => {
    while (next < previews.atlases.length) {
      const index = next++;
      dragImages[index] = await createImageBitmap(await fetchPage(previews.atlases[index], previews.assetVersion));
      downloadedPage();
    }
  }));
}
context.imageSmoothingQuality = 'high';
let ready = false;
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let phase = 0, clock = 0, offset = 0;
let block = sequencer.plan(target, createWalkState());
let renderedTarget = target;
let upcoming: ReferenceCut[] = [], planned: ReferenceCut[] = [];
let directionLoading: number | undefined;
let generation = 0, filling: number | undefined;
let lastTime = 0, carry = 0;
let drag: { id: number; x: number; start: number; moved: boolean } | undefined;
function paint(image: ImageBitmap, tile: number, columns: number, width: number, height: number, row: AngleFrame, yaw: number, quality: string) {
  paintRegion(image, tile % columns * width, Math.floor(tile / columns) * height,
    width, height, 0, 0, row, yaw, quality);
}
function paintRegion(image: ImageBitmap, x: number, y: number, width: number, height: number, dx: number, dy: number, row: AngleFrame, yaw: number, quality: string) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, x, y, width, height, dx, dy, width, height);
  direction.value = label(yaw);
  canvas.dataset.sourceFrame = String(row.sourceFrame);
  canvas.dataset.clip = row.clip;
  canvas.dataset.actualYaw = String(row.yaw);
  canvas.dataset.phase = String(phase);
  const hd=quality==='hd';
  canvas.dataset.sourcePhase = String(referenceMatches.frames[frameIndices.get(row)!].phase);
  canvas.dataset.referenceError = hd?String(block.referenceError):'';
  canvas.dataset.selector = referenceMatches.version;
  canvas.dataset.phaseError = hd?String(block.phaseError):'';
  canvas.dataset.swapped = String(hd&&block.swapped);
  canvas.dataset.halfCycle = String(hd&&block.halfCycle);
  canvas.dataset.relaxed = String(hd&&block.relaxed);
  canvas.dataset.continuation = String(hd&&block.sourceContinuation);
  canvas.dataset.cutTick = hd?String(block.before.tick):'';
  canvas.dataset.clock = String(clock);
  canvas.dataset.quality = quality;
  canvas.dataset.motionVerified = String(hd && !!block.qualityVerified);
  canvas.dataset.decodedPages = String(images.size);
  canvas.dataset.compressedPages = String(compressed.size);
  canvas.dataset.previewPages = String(dragImages.length);
  canvas.dataset.bufferedFrames = String(upcoming.reduce((sum,cut)=>sum+cut.count,0));
  canvas.dataset.pixelScale = '1';
}
function drawPreview() {
  const slot = Math.round(phase * previews.phases) % previews.phases;
  const tile = previews.tiles[previews.lookup[(target - minYaw) / previews.yawStep][slot]];
  const image = dragImages[tile.atlas];
  if (image) paintRegion(image, tile.x, tile.y, tile.width, tile.height, tile.offsetX, tile.offsetY, frames[tile.frame], target, 'drag-hd');
}
function draw() {
  if (drag?.moved || renderedTarget !== target) { drawPreview(); return; }
  const row = frames[block.start + Math.min(offset, block.count - 1)];
  const image = images.get(row.atlas);
  if (image) paint(image, row.tile, data.columns, data.tileWidth, data.tileHeight, row, renderedTarget, 'hd');
  else drawPreview();
}
async function prepare(candidate: typeof block) {
  const pages = new Set(frames.slice(candidate.start, candidate.start + candidate.count).map(row => row.atlas));
  await Promise.all([...pages].map(index => images.load(index)));
}
function retainPages() {
  images.retain([block, ...upcoming, ...planned].flatMap(candidate =>
    frames.slice(candidate.start, candidate.start + candidate.count).map(row => row.atlas)));
}
/** Decode three future cuts while the current cut is still being displayed. */
async function fillBuffer() {
  const epoch = generation;
  if (filling === epoch || renderedTarget !== target || drag?.moved) return;
  filling = epoch;
  try {
    while (upcoming.length < 3 && epoch === generation) {
      const candidate = sequencer.plan(target, (upcoming[upcoming.length - 1] ?? block).after);
      planned = [candidate]; retainPages();
      await prepare(candidate);
      if (epoch !== generation) return;
      upcoming.push(candidate); planned = []; retainPages();
    }
  } catch(error) { if (epoch === generation) failed(error); }
  finally { if (filling === epoch) filling = undefined; }
}
function failed(error?:unknown) {
  playing = false;
  surface.dataset.playing = 'false';
  surface.setAttribute('aria-busy', 'false');
  status.textContent = error instanceof WalkCoverageError?'이 각도의 보행 소스가 부족해 재생을 멈췄어요. 다른 각도를 선택해 주세요.':'프레임을 불러오지 못했어요. 새로고침해 주세요.';
}
/** Replace the direction only after its first four cuts have decoded. */
async function startDirection() {
  if (drag?.moved) return;
  const epoch = ++generation, requested = target;
  directionLoading = epoch;
  // Only displayed photos enter history. Cancelled, predecoded cuts never do.
  let state = ready ? rebaseWalkState(sequencer.afterFrames(block, offset + 1), clock) : createWalkState(0, clock);
  const sequence: ReferenceCut[] = [];
  upcoming = [];
  try {
    for (let index = 0; index < 4; index++) {
      const candidate = sequencer.plan(requested, state);
      sequence.push(candidate); state = candidate.after;
    }
    planned = sequence; retainPages();
    await Promise.all(sequence.map(prepare));
    if (epoch !== generation || requested !== target || drag?.moved) return;
    block = sequence[0]; upcoming = sequence.slice(1); planned = [];
    renderedTarget = requested;
    offset = 0; phase = clockPhase(clock);
    carry = 0; lastTime = 0; retainPages();
    if (ready) draw();
  } catch (error) { if (epoch === generation) throw error; }
  finally { if (directionLoading === epoch) directionLoading = undefined; }
}
function setAngle(value: number) {
  const next = snapYaw(value, minYaw, maxYaw);
  const changed = next !== target;
  target = next;
  surface.setAttribute('aria-valuenow', String(target));
  surface.setAttribute('aria-valuetext', label(target));
  if (ready && changed) {
    generation++; upcoming = []; planned = [];
    if (drag) drag.moved = true;
    draw();
    if (!drag?.moved) void startDirection().catch(failed);
  }
}
surface.addEventListener('pointerdown', event => {
  if (!ready || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
  drag = { id: event.pointerId, x: event.clientX, start: target, moved: false };
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
  const moved = drag.moved;
  drag = undefined;
  surface.dataset.dragging = 'false';
  persist();
  if (moved) void startDirection().catch(failed);
}
surface.addEventListener('pointerup', endDrag);
surface.addEventListener('pointercancel', endDrag);
surface.addEventListener('lostpointercapture', endDrag);
surface.addEventListener('keydown', event => {
  if (!ready) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    setAngle(target + (event.key === 'ArrowRight' ? 1 : -1) * ANGLE_STEP);
    persist();
  } else if (event.key === 'Home') {
    event.preventDefault(); setAngle(0); persist();
  } else if (event.code === 'Space') {
    event.preventDefault(); playing = !playing; carry = 0; lastTime = 0;
    surface.dataset.playing = String(playing);
    status.textContent = playing ? '재생' : '일시정지';
  }
});
window.addEventListener('blur', () => {
  const moved = drag?.moved;
  drag = undefined;
  surface.dataset.dragging = 'false';
  if (moved) void startDirection().catch(failed);
});
document.addEventListener('visibilitychange', () => { lastTime = 0; carry = 0; });
function tick(time: number) {
  if (ready && playing && !document.hidden) {
    carry += lastTime ? Math.min((time - lastTime) / 1000, 0.12) : 0;
    while (carry >= 1 / data.fps) {
      carry -= 1 / data.fps;
      if (drag?.moved) {
        // Drag uses the same independent gait clock as normal playback.
      } else if (directionLoading !== undefined || renderedTarget !== target) {
        carry = 0; break;
      } else if (offset + 1 < block.count) {
        offset++;
      } else {
        const next = upcoming.shift();
        // Slow decoding never advances the clock behind a repeated still.
        if (!next) { carry = 0; void fillBuffer(); break; }
        block = next; offset = 0;
        retainPages(); void fillBuffer();
      }
      clock++; phase = clockPhase(clock);
      draw();
    }
  }
  lastTime = time;
  requestAnimationFrame(tick);
}
async function load() {
  try {
    surface.dataset.playing = 'false';
    surface.dataset.totalPages = String(data.atlases.length + previews.atlases.length);
    await Promise.all([loadPhotographs(), loadPreviews()]);
    await startDirection();
    if (!images.get(frames[block.start].atlas)) throw new Error('Initial frame decode failed');
    ready = true;
    draw();
    surface.setAttribute('aria-busy', 'false');
    loading.hidden = true;
    surface.dataset.playing = String(playing);
    requestAnimationFrame(tick);
  } catch(error) { failed(error); }
}
setAngle(target); void load();
