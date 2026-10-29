import data from './angles.json';
import { AtlasPool } from './atlas-pool';
import { PhotoDownloads } from './photo-downloads';
import { directionPhotos, directionPages } from './direction-photos';
import { prepareLiveDirection } from './live-direction';
import { gptZeroTest } from './gpt-zero-test';
import { ANGLE_STEP, snapYaw } from './direction-step';
import type { AngleFrame } from './angle-match';
import {WalkCoverageError,rebaseWalkState} from './walk-sequencer';
import {clockPhase,createWalkState} from './reference-clock';
import { ReferenceSequencer,cutIndex,cutIndices, type ReferenceCut } from './reference-sequencer';
import referenceMatches from './reference-matches.json';
import {photoTransform,cutPhotoTransform,applyPhotoTransform,IDENTITY_PHOTO} from './photo-registration';

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
// Complete the selected edit before playback; nearby views warm afterwards.
const downloads = new PhotoDownloads(index => fetchPage(data.atlases[index], data.assetVersion), downloadedPage);
const images = new AtlasPool(async index => {
  const blob = await downloads.request(index);
  if (!blob) throw new Error('Photograph download cancelled');
  return createImageBitmap(blob);
}, 24);
let downloaded = 0, loadingPages: number[] = [], loadingGpt = false, warmGeneration = 0;
function downloadedPage() {
  downloaded++;
  const complete = loadingPages.filter(index => !!downloads.get(index)).length + (loadingGpt ? gptTest.downloaded : 0);
  const total = loadingPages.length + (loadingGpt ? gptTest.count : 0);
  loading.style.setProperty('--loaded', `${total ? Math.min(100, complete / total * 100) : 0}%`);
  surface.dataset.loadedPages = String(downloaded);
}
async function loadView(yaw: number, current: () => boolean) {
  const indices = directionPhotos(yaw), restored = gptTest.covers(yaw, indices, true);
  loadingPages = restored ? [] : directionPages(yaw); loadingGpt = restored;
  surface.dataset.startupPages = String(loadingPages.length + (restored ? gptTest.count : 0));
  if (restored) await gptTest.load();
  else await Promise.all(loadingPages.map(index => downloads.request(index, current)));
}
function warmNeighbors() {
  const epoch = ++warmGeneration;
  const neighbors = [renderedTarget - ANGLE_STEP, renderedTarget + ANGLE_STEP].filter(yaw => yaw >= minYaw && yaw <= maxYaw);
  const pages = [...new Set(neighbors.flatMap(directionPages))];
  void Promise.all(pages.map(index => downloads.request(index, () => epoch === warmGeneration && directionLoading === undefined && !document.hidden, false)))
    .catch(() => { /* The requested direction retries a speculative failure. */ });
}
context.imageSmoothingQuality = 'high';
let ready = false;
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let phase = 0, clock = 0, offset = 0;
let block = sequencer.plan(target, createWalkState());
let renderedTarget = target;
const LOOKAHEAD_CUTS = 8;
let decodeWaits = 0;
let upcoming: ReferenceCut[] = [], planned: ReferenceCut[] = [], bufferPlanned: ReferenceCut[] = [];
let directionLoading: number | undefined;
let generation = 0, stream = 0, filling: number | undefined;
let lastTime = 0, carry = 0;
let drag: { id: number; x: number; start: number } | undefined;
const gptTest = gptZeroTest(() => { if (ready) { draw(); void startDirection().catch(failed); } }, () => { if (ready) setAngle(0); }, downloadedPage);
function paint(image: ImageBitmap, tile: number, columns: number, width: number, height: number, row: AngleFrame, yaw: number, quality: string) {
  paintRegion(image, tile % columns * width, Math.floor(tile / columns) * height,
    width, height, 0, 0, row, yaw, quality);
}
function beginFrame(restored: boolean) {
  const scale = restored ? 1.5 : 1;
  if (canvas.width !== data.tileWidth * scale) {
    canvas.width = data.tileWidth * scale;
    canvas.height = data.tileHeight * scale;
  }
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.imageSmoothingQuality = 'high';
  context.clearRect(0, 0, data.tileWidth, data.tileHeight);
  canvas.dataset.pixelScale = String(scale);
}
function paintRegion(image: ImageBitmap, x: number, y: number, width: number, height: number, dx: number, dy: number, row: AngleFrame, yaw: number, quality: string) {
  const restored = quality === 'hd' ? gptTest.replacement(yaw, frameIndices.get(row)!) : undefined;
  beginFrame(!!restored);
  const aligned=quality==='hd'?!!block.registered:sequencer.usesRegistration(yaw);
  const transform=row.posture?(quality==='hd'?cutPhotoTransform(block,offset,row.posture,phase,yaw):aligned?photoTransform(row.posture,phase,yaw):IDENTITY_PHOTO):IDENTITY_PHOTO;
  context.save();applyPhotoTransform(context,transform);
  if (restored) {
    context.save(); applyPhotoTransform(context, gptTest.registration(frameIndices.get(row)!) ?? IDENTITY_PHOTO);
    context.drawImage(restored, 0, 0, restored.width, restored.height, 0, 0, data.tileWidth, data.tileHeight);
    context.restore();
  }
  else context.drawImage(image, x, y, width, height, dx, dy, width, height);
  context.restore();canvas.dataset.photoTransform=JSON.stringify(transform);
  direction.value = label(yaw);
  canvas.dataset.sourceFrame = String(row.sourceFrame);
  canvas.dataset.frameIndex = String(frameIndices.get(row)!);
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
  canvas.dataset.motionVerified = String(!restored && hd && !!block.qualityVerified);
  canvas.dataset.gptRestored = String(!!restored);
  canvas.dataset.decodedPages = String(images.size);
  canvas.dataset.compressedPages = String(downloads.size);
  canvas.dataset.previewPages = '0';
  canvas.dataset.bufferedFrames = String(upcoming.reduce((sum,cut)=>sum+cut.count,0));
  canvas.dataset.directionLoading = String(directionLoading !== undefined);
  canvas.dataset.requestedYaw = String(target);
}
function draw() {
  const still = gptTest.still(renderedTarget);
  if (still) {
    beginFrame(still.edited);
    context.save();
    if (still.edited) applyPhotoTransform(context, gptTest.registration(still.index) ?? IDENTITY_PHOTO);
    context.drawImage(still.image, 0, 0, still.image.width, still.image.height, 0, 0, data.tileWidth, data.tileHeight);
    context.restore();
    direction.value = label(0);
    canvas.dataset.quality = 'quality-test-still';
    canvas.dataset.gptRestored = String(still.edited);
    canvas.dataset.motionVerified = 'false';
    canvas.dataset.sourceFrame = String(frames[still.index].sourceFrame);
    canvas.dataset.frameIndex = String(still.index);
    canvas.dataset.clip = frames[still.index].clip;
    canvas.dataset.actualYaw = String(frames[still.index].yaw);
    canvas.dataset.clock = String(clock);
    canvas.dataset.phase = String(phase);
    canvas.dataset.referenceError = '';
    canvas.dataset.photoTransform = JSON.stringify(IDENTITY_PHOTO);
    return;
  }
  const row = frames[cutIndex(block,Math.min(offset, block.count - 1))];
  const image = images.get(row.atlas);
  const restored = gptTest.replacement(renderedTarget, frameIndices.get(row)!);
  if (!image && restored) paintRegion(restored, 0, 0, restored.width, restored.height, 0, 0, row, renderedTarget, 'hd');
  else if (image) paint(image, row.tile, data.columns, data.tileWidth, data.tileHeight, row, renderedTarget, 'hd');

}
async function prepare(candidate: typeof block, yaw = renderedTarget, requested = false) {
  const pages = new Set(cutIndices(candidate).map(i => frames[i].atlas));
  await Promise.all([gptTest.covers(yaw, cutIndices(candidate), requested) ? Promise.resolve() : Promise.all([...pages].map(index => images.load(index))), gptTest.prepare(yaw, cutIndices(candidate), requested)]);
}
function retainPages() {
  const indices = [block, ...upcoming, ...planned, ...bufferPlanned].flatMap(candidate => cutIndices(candidate));
  images.retain(indices.map(i => frames[i].atlas));
  gptTest.retain(indices);
}
/** Keep almost a second of complete appearances decoded ahead of playback. */
async function fillBuffer() {
  const epoch = stream;
  if (filling === epoch) return;
  filling = epoch;
  try {
    while (upcoming.length < LOOKAHEAD_CUTS && epoch === stream) {
      const candidate = sequencer.plan(renderedTarget, (upcoming[upcoming.length - 1] ?? block).after);
      bufferPlanned = [candidate]; retainPages();
      await prepare(candidate);
      if (epoch !== stream) return;
      upcoming.push(candidate); bufferPlanned = []; retainPages();
    }
  } catch(error) { if (epoch === stream) failed(error); }
  finally { if (filling === epoch) filling = undefined; }
}
function failed(error?:unknown) {
  playing = false;
  surface.dataset.playing = 'false';
  surface.setAttribute('aria-busy', 'false');
  status.textContent = error instanceof WalkCoverageError?'이 각도의 보행 소스가 부족해 재생을 멈췄어요. 다른 각도를 선택해 주세요.':'프레임을 불러오지 못했어요. 새로고침해 주세요.';
}
/** Decode the new view while the current HD sequence keeps playing. Only the
 * small entry window is needed to turn; the regular buffer fills afterwards. */
async function startDirection() {
  const epoch = ++generation, requested = target;
  directionLoading = epoch;
  try {
    if (ready) loading.hidden = false;
    await loadView(requested, () => epoch === generation);
    if (epoch !== generation) return;
    const sequence = await prepareLiveDirection({
      current: () => epoch === generation && requested === target,
      plan: () => {
        // Re-plan at the live tick after decoding. Speculative frames never
        // become displayed history, and a slow decode cannot rewind the gait.
        let state = ready ? rebaseWalkState(sequencer.afterFrames(block, offset + 1), clock) : createWalkState();
        const sequence: ReferenceCut[] = [];
        for (let index = 0; index <= (ready ? 1 : LOOKAHEAD_CUTS); index++) {
          const candidate = sequencer.plan(requested, state);
          sequence.push(candidate); state = candidate.after;
        }
        planned = sequence; retainPages();
        return sequence;
      },
      available: candidate => (gptTest.covers(requested, cutIndices(candidate), true) || cutIndices(candidate).every(i => !!images.get(frames[i].atlas))) && gptTest.available(requested, cutIndices(candidate)),
      prepare: candidate => prepare(candidate, requested, true),
    });
    // Await itself yields, so recheck cancellation before installing the edit.
    if (!sequence || epoch !== generation || requested !== target) return;
    gptTest.activate();
    block = sequence[0]; upcoming = sequence.slice(1);
    planned = []; bufferPlanned = []; stream++;
    renderedTarget = requested;
    directionLoading = undefined;
    offset = 0; phase = clockPhase(clock);
    retainPages();
    if (ready) { draw(); loading.hidden = true; warmNeighbors(); }
    void fillBuffer();
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
    void startDirection().catch(failed);
  }
}
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
  drag = undefined;
  surface.dataset.dragging = 'false';
});
document.addEventListener('visibilitychange', () => { lastTime = 0; carry = 0; });
function tick(time: number) {
  if (ready && playing && !document.hidden && !gptTest.isStill(renderedTarget)) {
    carry += lastTime ? Math.min((time - lastTime) / 1000, 0.12) : 0;
    while (carry >= 1 / data.fps) {
      carry -= 1 / data.fps;
      if (offset + 1 < block.count) {
        offset++;
      } else {
        const next = upcoming.shift();
        // Slow decoding never advances the clock behind a repeated still.
        if (!next) { canvas.dataset.decodeWaits = String(++decodeWaits); carry = 0; void fillBuffer(); break; }
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
    surface.dataset.totalPages = String(data.atlases.length + gptTest.count);
    await startDirection();
    if (!images.get(frames[block.start].atlas) && !gptTest.replacement(target, block.start)) throw new Error('Initial frame decode failed');
    ready = true;
    gptTest.ready();
    surface.dataset.readyAt = String(performance.now());
    draw();
    surface.setAttribute('aria-busy', 'false');
    loading.hidden = true;
    surface.dataset.playing = String(playing);
    requestAnimationFrame(tick);
    warmNeighbors();
  } catch(error) { failed(error); }
}
setAngle(target); void load();
