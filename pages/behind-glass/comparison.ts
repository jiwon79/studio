import './comparison.css';

document.title = '걷기 비교 · Behind Glass';
document.body.innerHTML = `
  <header><a href="?motion=biomechanical">← 작품으로</a><h1>걷기 비교</h1><p>같은 크기와 보행 주기 · 인물을 따라가는 시점</p></header>
  <main>
    <section><div class="label"><span>이전 버전</span><small>수식으로 만든 보행</small></div><iframe title="이전 버전 보행" src="?motion=legacy&comparison=1"></iframe></section>
    <section><div class="label"><span>생체역학 모델</span><small>OpenSim · Gait2392</small></div><iframe title="OpenSim 보행" src="?motion=biomechanical&comparison=1"></iframe></section>
  </main>
  <footer>
    <div class="controls"><button id="play" type="button">일시정지</button><label>속도 <select id="speed"><option value="1">1×</option><option value="0.5" selected>0.5×</option><option value="0.25">0.25×</option></select></label><label class="joints"><input id="joints" type="checkbox"> 관절 보기</label><button id="restart" type="button">처음부터</button></div>
    <label class="timeline">보행 한 주기 <input id="time" type="range" min="0" max="1.23" step="0.001" value="0"><output id="phase">0%</output></label>
    <p class="note">OpenSim의 근육 기반 보행 계산 결과를 관절 궤적으로 변환해 재생합니다. 웹에서 근육 힘을 실시간 계산하는 방식은 아닙니다.</p>
    <p id="status" role="status">비교 화면을 준비하고 있습니다.</p>
  </footer>`;
const frames = [...document.querySelectorAll('iframe')];
const play = document.querySelector<HTMLButtonElement>('#play')!;
const speed = document.querySelector<HTMLSelectElement>('#speed')!;
const joints = document.querySelector<HTMLInputElement>('#joints')!;
const timeline = document.querySelector<HTMLInputElement>('#time')!;
const phase = document.querySelector<HTMLOutputElement>('#phase')!;
const status = document.querySelector<HTMLElement>('#status')!;
const ready = new Set<MessageEventSource>();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let playing = !reduced.matches;
let time = 0;
let previous = performance.now();
function draw() {
  for (const frame of frames) frame.contentWindow?.postMessage({ type: 'behind-glass-clock', time, joints: joints.checked }, location.origin);
  timeline.value = String(time);
  phase.value = `${Math.round(time / 1.23 * 100)}%`;
  play.textContent = playing ? '일시정지' : '재생';
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.data?.type !== 'behind-glass-ready' || !frames.some(frame => frame.contentWindow === event.source)) return;
  ready.add(event.source!);
  if (ready.size === 2) { status.textContent = ''; previous = performance.now(); draw(); }
});
play.addEventListener('click', () => { playing = !playing; draw(); });
joints.addEventListener('change', draw);
timeline.addEventListener('input', () => { playing = false; time = Number(timeline.value); draw(); });
document.querySelector('#restart')!.addEventListener('click', () => { time = 0; draw(); });
reduced.addEventListener('change', e => { if (e.matches) { playing = false; draw(); } });
function tick(now: number) {
  const dt = Math.min((now - previous) / 1000, .05); previous = now;
  if (playing && ready.size === 2 && !document.hidden) { time = (time + dt * Number(speed.value)) % 1.23; draw(); }
  requestAnimationFrame(tick);
}
draw();
requestAnimationFrame(tick);
export {};
