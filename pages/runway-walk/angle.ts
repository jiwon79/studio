import { qualityLibrary } from './quality-library';
import data from './angles.json';
import { prepareLiveDirection } from './live-direction';
import { startupProgress } from './startup-progress';
import { ANGLE_STEP, snapYaw } from './direction-step';
import type { AngleFrame } from './angle-match';
import {WalkCoverageError,rebaseWalkState} from './walk-sequencer';
import {clockPhase,createWalkState} from './reference-clock';
import { ReferenceSequencer,cutIndex,cutIndices, type ReferenceCut } from './reference-sequencer';
import referenceMatches from './reference-matches.json';
import {cutPhotoTransform,applyPhotoTransform,IDENTITY_PHOTO} from './photo-registration';

const frames: AngleFrame[] = data.frames;
const sequencer = new ReferenceSequencer(frames, data.holdFrames);
const frameIndices=new Map(frames.map((frame,index)=>[frame,index]));
const surface = document.querySelector<HTMLElement>('#surface')!;
const canvas = document.querySelector<HTMLCanvasElement>('#person')!;
const context = canvas.getContext('2d')!;
const direction = document.querySelector<HTMLOutputElement>('#direction')!;
const status = document.querySelector<HTMLElement>('#status')!;
const loading = document.querySelector<HTMLElement>('#loading')!;
const startup = startupProgress(loading);
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

const photographs = qualityLibrary(() => { if (!ready) startup.update(photographs.stats); });
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
function beginFrame() {
  const scale = 1.5;
  if (canvas.width !== data.tileWidth * scale) {
    canvas.width = data.tileWidth * scale;
    canvas.height = data.tileHeight * scale;
  }
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.imageSmoothingQuality = 'high';
  context.clearRect(0, 0, data.tileWidth, data.tileHeight);
  canvas.dataset.pixelScale = String(scale);
}
function paint(row: AngleFrame, yaw: number) {
  const index = frameIndices.get(row)!;
  const image = photographs.image(index);
  if (!image) throw new Error(`Photograph not decoded: ${index}`);
  beginFrame();
  const transform = row.posture ? cutPhotoTransform(block, offset, row.posture, phase, yaw) : IDENTITY_PHOTO;
  context.save(); applyPhotoTransform(context, transform);
  context.save(); applyPhotoTransform(context, photographs.registration(index));
  context.drawImage(image, 0, 0, image.width, image.height, 0, 0, data.tileWidth, data.tileHeight);
  context.restore();
  context.restore();canvas.dataset.photoTransform=JSON.stringify(transform);
  direction.value = label(yaw);
  canvas.dataset.sourceFrame = String(row.sourceFrame);
  canvas.dataset.frameIndex = String(frameIndices.get(row)!);
  canvas.dataset.clip = row.clip;
  canvas.dataset.actualYaw = String(row.yaw);
  canvas.dataset.phase = String(phase);
  canvas.dataset.sourcePhase = String(referenceMatches.frames[frameIndices.get(row)!].phase);
  canvas.dataset.referenceError = String(block.referenceError);
  canvas.dataset.selector = referenceMatches.version;
  canvas.dataset.phaseError = String(block.phaseError);
  canvas.dataset.swapped = String(block.swapped);
  canvas.dataset.halfCycle = String(block.halfCycle);
  canvas.dataset.relaxed = String(block.relaxed);
  canvas.dataset.continuation = String(block.sourceContinuation);
  canvas.dataset.cutTick = String(block.before.tick);
  canvas.dataset.clock = String(clock);
  canvas.dataset.quality = 'enhanced';
  canvas.dataset.gptRestored = 'true';
  canvas.dataset.qualityProvider = photographs.provider(index);
  canvas.dataset.decodedPhotos = String(photographs.decoded);
  canvas.dataset.bufferedFrames = String(upcoming.reduce((sum,cut)=>sum+cut.count,0));
  canvas.dataset.directionLoading = String(directionLoading !== undefined);
  canvas.dataset.requestedYaw = String(target);
}
function draw() {
  paint(frames[cutIndex(block, Math.min(offset, block.count - 1))], renderedTarget);
}
async function prepare(candidate: typeof block) {
  await photographs.prepare(cutIndices(candidate));
}
function retainPhotos() {
  photographs.retain([block, ...upcoming, ...planned, ...bufferPlanned].flatMap(candidate => cutIndices(candidate)));
}
/** Keep almost a second of complete appearances decoded ahead of playback. */
async function fillBuffer() {
  const epoch = stream;
  if (filling === epoch) return;
  filling = epoch;
  try {
    while (upcoming.length < LOOKAHEAD_CUTS && epoch === stream) {
      const candidate = sequencer.plan(renderedTarget, (upcoming[upcoming.length - 1] ?? block).after);
      bufferPlanned = [candidate]; retainPhotos();
      await prepare(candidate);
      if (epoch !== stream) return;
      upcoming.push(candidate); bufferPlanned = []; retainPhotos();
    }
  } catch(error) { if (epoch === stream) failed(error); }
  finally { if (filling === epoch) filling = undefined; }
}
function failed(error?:unknown) {
  playing = false;
  surface.dataset.playing = 'false';
  surface.setAttribute('aria-busy', 'false');
  status.textContent = error instanceof WalkCoverageError?'이 각도의 보행 소스가 부족해 재생을 멈췄어요. 다른 각도를 선택해 주세요.':'프레임을 불러오지 못했어요. 새로고침해 주세요.';
  if (!ready) startup.fail();
}
function candidateAvailable(candidate: ReferenceCut) {
  return photographs.available(cutIndices(candidate));
}
/** Decode the new view while the current HD sequence keeps playing. Only the
 * small entry window is needed to turn; the regular buffer fills afterwards. */
async function startDirection() {
  const epoch = ++generation, requested = target;
  directionLoading = epoch;
  try {
    if (ready) loading.hidden = false;
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
        planned = sequence; retainPhotos();
        if (!ready) startup.prepare(sequence.filter(candidate => candidateAvailable(candidate)).length, sequence.length);
        return sequence;
      },
      available: candidate => candidateAvailable(candidate),
      prepare: async candidate => {
        await prepare(candidate);
        if (!ready && epoch === generation) startup.prepare(planned.filter(cut => candidateAvailable(cut)).length, planned.length);
      },
    });
    // Await itself yields, so recheck cancellation before installing the edit.
    if (!sequence || epoch !== generation || requested !== target) return;
    block = sequence[0]; upcoming = sequence.slice(1);
    planned = []; bufferPlanned = []; stream++;
    renderedTarget = requested;
    directionLoading = undefined;
    offset = 0; phase = clockPhase(clock);
    retainPhotos();
    if (ready) { draw(); loading.hidden = true; }
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
  if (ready && playing && !document.hidden) {
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
        retainPhotos(); void fillBuffer();
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
    document.body.dataset.booting = 'true'; loading.dataset.mode = 'startup'; loading.hidden = false;
    startup.update(photographs.stats);
    await photographs.preloadAll();
    startup.update(photographs.stats);
    await startDirection();
    if (!photographs.image(block.start)) throw new Error('Initial frame decode failed');
    ready = true;
    surface.dataset.readyAt = String(performance.now());
    draw();
    surface.setAttribute('aria-busy', 'false');
    startup.finish();
    surface.dataset.playing = String(playing);
    requestAnimationFrame(tick);

  } catch(error) { failed(error); }
}
document.querySelector('#loading-retry')!.addEventListener('click', () => location.reload());
setAngle(target); void load();
