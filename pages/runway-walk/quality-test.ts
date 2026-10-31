import gptManifest from './assets/gpt-quality/manifest.json';
import higgsfieldManifest from './assets/higgsfield-quality-45/manifest.json';
import addedManifest from './assets/higgsfield-quality/manifest.json';
import { directionPhotos } from './direction-photos';
type ReviewFrame = { index: number; group: number; original: string; edited: string; qualityRegistration?: { scale: number; dx: number; dy: number } };
type ReviewGroup = { id: string; label: string; indices: number[] };
type ReviewLibrary = { additionalTarget: number; generated: number; frames: ReviewFrame[]; groups?: ReviewGroup[] };
const prefix = (library: ReviewLibrary, folder: string): ReviewLibrary => ({ ...library, frames: library.frames.map(row => ({ ...row, original: `${folder}/${row.original}`, edited: `${folder}/${row.edited}` })) });
const initial = prefix(higgsfieldManifest, 'higgsfield-quality-45'), added = prefix(addedManifest, 'higgsfield-quality');
const isHiggsfield = new URLSearchParams(location.search).get('provider') === 'higgsfield';
const manifest: ReviewLibrary = isHiggsfield ? { additionalTarget: higgsfieldManifest.generated + addedManifest.additionalTarget, generated: initial.generated + added.generated, frames: [...initial.frames, ...added.frames], groups: [...(initial.groups ?? []), ...(added.groups ?? [])] } : prefix(gptManifest, 'gpt-quality');
const files = import.meta.glob<string>('./assets/{gpt-quality,higgsfield-quality,higgsfield-quality-45}/*.webp', { eager: true, query: '?url', import: 'default' });
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const group = el<HTMLSelectElement>('group'), speed = el<HTMLSelectElement>('speed'), seek = el<HTMLInputElement>('seek');
const button = el<HTMLButtonElement>('play'), state = el('state');
const align = el<HTMLInputElement>('align');
const canvases = [el<HTMLCanvasElement>('before'), el<HTMLCanvasElement>('after')];
const images = new Map<string, HTMLImageElement>();
const groups: ReviewGroup[] = (manifest as { groups?: ReviewGroup[] }).groups ?? [...new Set(manifest.frames.map(r => r.group))].map(angle => ({ id: String(angle), label: `${angle > 0 ? '+' : ''}${angle}°`, indices: manifest.frames.filter(r => r.group === angle).map(r => r.index) }));
for (const row of groups) group.add(new Option(row.label, row.id));
const linked = new URLSearchParams(location.search).get('group');
if (groups.some(row => row.id === linked)) group.value = linked!;
const combinedIndices = new Set([...gptManifest.frames, ...higgsfieldManifest.frames, ...addedManifest.frames].map(row => row.index));
const completeAngles = Array.from({ length: 37 }, (_, i) => i * 5 - 90).filter(yaw => directionPhotos(yaw).every(index => combinedIndices.has(index)));
el('scope').textContent = isHiggsfield ? `Higgsfield API · GPT Image 2.5 · 전체 ${manifest.additionalTarget}장 중 ${manifest.generated}장 생성. 원본 사진만 입력해 화질·누끼를 보정했습니다.` : `내장 GPT 이미지 · ${manifest.generated.toLocaleString()}장 생성. 자세·각도 변경 가이드 없이 원본 사진의 화질·누끼만 보정합니다.`;
el('scope').textContent += ` 두 제공자의 사진을 합쳐 전체 사진이 준비된 ${completeAngles.join(', ')}°는 작품에서 ON/OFF 비교할 수 있습니다. 나머지 각도는 원본으로 유지합니다.`;
if (isHiggsfield) el<HTMLAnchorElement>('artwork').href = './angle.html?angle=45';
el('edited-label').textContent = isHiggsfield ? 'Higgsfield · GPT Image 2.5' : 'GPT 화질 보정';
let tick = 0, epoch = 0, loading = 0, ready = false, playing = false;
const rows = () => groups.find(row => row.id === group.value)!.indices.map(index => manifest.frames.find(row => row.index === index)!);
function stop() { playing = false; epoch++; button.textContent = '다시 재생'; }
function draw() {
  const row = rows()[tick];
  [row.original, row.edited].forEach((file, i) => {
    const canvas = canvases[i], ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (i === 1 && align.checked) {
      const fit = (row as { qualityRegistration?: { scale: number; dx: number; dy: number } }).qualityRegistration;
      if (fit) ctx.setTransform(fit.scale, 0, 0, fit.scale, fit.dx * canvas.width / 512, fit.dy * canvas.height / 768);
    }
    ctx.drawImage(images.get(file)!, 0, 0, canvas.width, canvas.height);
    canvas.dataset.index = String(row.index);
  });
  seek.value = String(tick + 1); el<HTMLOutputElement>('frame').value = `${tick + 1} / ${rows().length} · 사진 ${row.index}`;
}
function play() {
  if (!ready) return;
  if (playing) { stop(); state.textContent = '일시정지'; return; }
  stop(); tick = 0; draw(); playing = true; button.textContent = '일시정지';
  const run = epoch, start = performance.now(), duration = 1000 / 25 / Number(speed.value);
  state.textContent = '원본과 보정본을 같은 순서·같은 시점으로 재생 중';
  function frame(now: number) {
    if (!playing || run !== epoch) return;
    const elapsed = Math.floor((now - start) / duration), next = Math.min(elapsed, rows().length - 1);
    if (next !== tick) { tick = next; draw(); }
    if (elapsed >= rows().length) { stop(); state.textContent = `구간 끝 · ${rows().length}프레임 구간입니다.`; return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
button.onclick = play;
seek.oninput = () => { stop(); tick = Number(seek.value) - 1; draw(); state.textContent = '프레임 정지 비교'; };
group.onchange = () => { void loadGroup(); };
speed.onchange = () => { stop(); if (ready) play(); };
align.onchange = () => { if (ready) draw(); };
async function loadGroup() {
  stop(); ready = false; button.disabled = true; seek.disabled = true;
  el<HTMLAnchorElement>('artwork').href = `./angle.html?angle=${Number(group.value.split(':')[0])}`;
  const version = ++loading, selected = rows(), wanted = [...new Set(selected.flatMap(row => [row.original, row.edited]))];
  images.clear(); canvases.forEach(canvas => { const ctx = canvas.getContext('2d')!; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.dataset.index = ''; });
  el<HTMLOutputElement>('frame').value = '준비 중';
  state.textContent = `${wanted.length}장 준비 중…`;
  seek.max = String(selected.length); seek.value = '1';
  const url = new URL(location.href); url.searchParams.set('group', group.value); history.replaceState(null, '', url);
  try {
    const loaded = await Promise.all(wanted.map(async file => {
      const image = new Image(); image.src = files[`./assets/${file}`];
      await image.decode(); return [file, image] as const;
    }));
    if (loading !== version) return;
    loaded.forEach(([file, image]) => images.set(file, image));
    ready = true; button.disabled = false; seek.disabled = false; play();
  } catch { if (loading === version) state.textContent = '사진을 불러오지 못했습니다. 새로고침해 주세요.'; }
}
void loadGroup();
