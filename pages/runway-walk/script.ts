import manifest from './manifest.json';

const sources = {
  color: new URL('./media/runway-color.mp4', import.meta.url).href,
  footfall: new URL('./media/runway-footfall.mp4', import.meta.url).href,
  frame: new URL('./media/runway-frame.mp4', import.meta.url).href,
  step: new URL('./media/runway-step.mp4', import.meta.url).href,
};
type Source = keyof typeof sources;
type Mode = Source | 'compare';
const labels: Record<Source, string> = {
  color: '01 · 색의 흐름', footfall: '03 · 발 디딤', frame: '기존 · 매 프레임', step: '기존 · 3프레임',
};
const video = document.querySelector<HTMLVideoElement>('#walk')!;
const footfall = document.querySelector<HTMLVideoElement>('#footfall')!;
const companion = document.querySelector<HTMLElement>('#companion')!;
const primaryLabel = document.querySelector<HTMLElement>('#primary-label')!;
const toggle = document.querySelector<HTMLButtonElement>('#toggle')!;
const frame = document.querySelector<HTMLInputElement>('#frame')!;
const position = document.querySelector<HTMLOutputElement>('#position')!;
const speed = document.querySelector<HTMLSelectElement>('#speed')!;
const download = document.querySelector<HTMLAnchorElement>('#download')!;
const downloadFootfall = document.querySelector<HTMLAnchorElement>('#download-footfall')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const modes = document.querySelectorAll<HTMLButtonElement>('[data-mode]');
const posters = {
  color: new URL('./media/poster-color.jpg', import.meta.url).href,
  footfall: new URL('./media/poster-footfall.jpg', import.meta.url).href,
  frame: new URL('./media/poster.jpg', import.meta.url).href,
  step: new URL('./media/poster.jpg', import.meta.url).href,
};
footfall.poster = posters.footfall;
downloadFootfall.href = sources.footfall;
frame.max = String(manifest.frames - 1);
let mode: Mode = 'compare';
let pendingSwitch: { time: number; playing: boolean } | undefined;

function showPosition() {
  const index = Math.min(manifest.frames - 1, Math.floor(video.currentTime * manifest.fps));
  frame.value = String(index);
  position.value = `${String(index + 1).padStart(3, '0')} / ${manifest.frames}`;
}
function playbackState() {
  toggle.textContent = video.paused ? '▶' : 'Ⅱ';
  toggle.setAttribute('aria-label', video.paused ? '재생' : '일시정지');
}
async function syncCompanion() {
  if (mode !== 'compare' || footfall.readyState < 2) return;
  if (Math.abs(footfall.currentTime - video.currentTime) > 0.08) footfall.currentTime = video.currentTime;
  footfall.playbackRate = video.playbackRate;
  if (video.paused) footfall.pause();
  else if (footfall.paused) {
    try { await footfall.play(); } catch { /* A later user play can retry. */ }
  }
}
async function play() {
  try { await video.play(); await syncCompanion(); } catch { playbackState(); }
}
function seek(index: number) {
  video.pause();
  const time = (Math.max(0, Math.min(manifest.frames - 1, index)) + 0.1) / manifest.fps;
  video.currentTime = time;
  if (mode === 'compare' && footfall.readyState >= 1) footfall.currentTime = time;
  showPosition();
}
function selectMode(nextMode: Mode, initial = false) {
  const playing = initial ? !matchMedia('(prefers-reduced-motion: reduce)').matches : !video.paused;
  pendingSwitch = { time: initial ? 0 : video.currentTime, playing };
  mode = nextMode;
  const primary: Source = mode === 'compare' ? 'color' : mode;
  document.body.classList.toggle('comparing', mode === 'compare');
  companion.hidden = mode !== 'compare';
  downloadFootfall.hidden = mode !== 'compare';
  primaryLabel.textContent = labels[primary];
  video.setAttribute('aria-label', `${labels[primary]} 런웨이 콜라주`);
  for (const item of modes) item.setAttribute('aria-pressed', String(item.dataset.mode === mode));
  video.poster = posters[primary];
  video.autoplay = playing;
  video.src = sources[primary];
  if (mode === 'compare' && !footfall.getAttribute('src')) footfall.src = sources.footfall;
  if (mode !== 'compare') footfall.pause();
  download.href = sources[primary];
  download.download = `runway-${primary}.mp4`;
  download.textContent = mode === 'compare' ? '색의 흐름 MP4 ↗' : 'MP4 다운로드 ↗';
  status.textContent = '영상을 불러오는 중…';
  frame.disabled = true;
  const url = new URL(location.href);
  url.searchParams.set('mode', mode);
  history.replaceState(null, '', url);
}
video.addEventListener('loadedmetadata', () => {
  video.playbackRate = Number(speed.value);
  frame.disabled = false;
  if (pendingSwitch) {
    video.currentTime = Math.min(pendingSwitch.time, video.duration - 1 / manifest.fps);
    const shouldPlay = pendingSwitch.playing;
    pendingSwitch = undefined;
    if (shouldPlay) void play();
    else video.pause();
  }
  showPosition();
});
video.addEventListener('canplay', () => { status.textContent = ''; void syncCompanion(); });
footfall.addEventListener('canplay', () => { void syncCompanion(); });
for (const item of [video, footfall]) {
  item.addEventListener('error', () => { status.textContent = '영상을 불러오지 못했어요. 페이지를 새로고침해 주세요.'; });
}
video.addEventListener('play', () => { playbackState(); void syncCompanion(); });
video.addEventListener('pause', () => { playbackState(); footfall.pause(); });
video.addEventListener('timeupdate', showPosition);
video.addEventListener('seeked', () => { showPosition(); void syncCompanion(); });
if ('requestVideoFrameCallback' in video) {
  video.requestVideoFrameCallback(function updateFrame() {
    showPosition();
    if (mode === 'compare') void syncCompanion();
    video.requestVideoFrameCallback(updateFrame);
  });
}
toggle.addEventListener('click', () => { if (video.paused) void play(); else video.pause(); });
frame.addEventListener('input', () => seek(Number(frame.value)));
document.querySelector('#previous')!.addEventListener('click', () => seek(Number(frame.value) - 1));
document.querySelector('#next')!.addEventListener('click', () => seek(Number(frame.value) + 1));
speed.addEventListener('change', () => { video.playbackRate = Number(speed.value); void syncCompanion(); });
for (const button of modes) button.addEventListener('click', () => {
  const nextMode = button.dataset.mode as Mode;
  if (nextMode !== mode) selectMode(nextMode);
});
const queryMode = new URL(location.href).searchParams.get('mode');
selectMode(queryMode && [...Object.keys(sources), 'compare'].includes(queryMode) ? queryMode as Mode : 'compare', true);
playbackState();
