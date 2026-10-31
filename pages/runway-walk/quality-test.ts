import manifest from './assets/gpt-quality/manifest.json';
const files = import.meta.glob<string>('./assets/gpt-quality/*.webp', { eager: true, query: '?url', import: 'default' });
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const group = el<HTMLSelectElement>('group'), speed = el<HTMLSelectElement>('speed'), seek = el<HTMLInputElement>('seek');
const button = el<HTMLButtonElement>('play'), state = el('state');
const canvases = [el<HTMLCanvasElement>('before'), el<HTMLCanvasElement>('after')];
const images = new Map<string, HTMLImageElement>();
let tick = 0, epoch = 0, ready = false, playing = false;
const rows = () => manifest.frames.filter(r => r.group === Number(group.value));
function stop() { playing = false; epoch++; button.textContent = '다시 재생'; }
function draw() {
  const row = rows()[tick];
  [row.original, row.edited].forEach((file, i) => {
    const canvas = canvases[i], ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
group.onchange = () => { stop(); if (ready) play(); };
speed.onchange = () => { stop(); if (ready) play(); };
void Promise.all(manifest.frames.flatMap(row => [row.original, row.edited]).map(async file => {
  const image = new Image(); image.src = files[`./assets/gpt-quality/${file}`];
  await image.decode(); images.set(file, image);
})).then(() => { ready = true; button.disabled = false; seek.disabled = false; play(); })
  .catch(() => { state.textContent = '사진을 불러오지 못했습니다. 새로고침해 주세요.'; });
