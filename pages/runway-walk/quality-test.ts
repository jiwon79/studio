import manifest from './assets/gpt-quality/manifest.json';
const files = import.meta.glob<string>('./assets/gpt-quality/*.webp', { eager: true, query: '?url', import: 'default' });
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const group = el<HTMLSelectElement>('group'), speed = el<HTMLSelectElement>('speed'), seek = el<HTMLInputElement>('seek');
const button = el<HTMLButtonElement>('play'), state = el('state');
const align = el<HTMLInputElement>('align');
const canvases = [el<HTMLCanvasElement>('before'), el<HTMLCanvasElement>('after')];
const images = new Map<string, HTMLImageElement>();
type ReviewGroup = { id: string; label: string; indices: number[] };
const groups: ReviewGroup[] = (manifest as { groups?: ReviewGroup[] }).groups ?? [...new Set(manifest.frames.map(r => r.group))].map(angle => ({ id: String(angle), label: `${angle > 0 ? '+' : ''}${angle}°`, indices: manifest.frames.filter(r => r.group === angle).map(r => r.index) }));
for (const row of groups) group.add(new Option(row.label, row.id));
const linked = new URLSearchParams(location.search).get('group');
if (groups.some(row => row.id === linked)) group.value = linked!;
el('scope').textContent = `전체 추가 대상 ${manifest.additionalTarget.toLocaleString()}장 중 ${manifest.generated.toLocaleString()}장을 생성한 중간 결과입니다. 자세·각도 변경 가이드는 사용하지 않았습니다. 아직 기본 작품에 적용하지 않았습니다.`;
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
    if (elapsed >= rows().length) { stop(); state.textContent = '구간 끝 · 반복 경계가 없는 3장 구간입니다.'; return; }
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
  const version = ++loading, selected = rows(), wanted = [...new Set(selected.flatMap(row => [row.original, row.edited]))];
  images.clear(); canvases.forEach(canvas => { const ctx = canvas.getContext('2d')!; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.dataset.index = ''; });
  el<HTMLOutputElement>('frame').value = '준비 중';
  state.textContent = `${wanted.length}장 준비 중…`;
  seek.max = String(selected.length); seek.value = '1';
  const url = new URL(location.href); url.searchParams.set('group', group.value); history.replaceState(null, '', url);
  try {
    const loaded = await Promise.all(wanted.map(async file => {
      const image = new Image(); image.src = files[`./assets/gpt-quality/${file}`];
      await image.decode(); return [file, image] as const;
    }));
    if (loading !== version) return;
    loaded.forEach(([file, image]) => images.set(file, image));
    ready = true; button.disabled = false; seek.disabled = false; play();
  } catch { if (loading === version) state.textContent = '사진을 불러오지 못했습니다. 새로고침해 주세요.'; }
}
void loadGroup();
