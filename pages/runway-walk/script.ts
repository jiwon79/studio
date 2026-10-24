import manifest from './manifest.json';

const sources = {
  frame: new URL('./media/runway-frame.mp4', import.meta.url).href,
  step: new URL('./media/runway-step.mp4', import.meta.url).href,
};
const video = document.querySelector<HTMLVideoElement>('#walk')!;
const toggle = document.querySelector<HTMLButtonElement>('#toggle')!;
const frame = document.querySelector<HTMLInputElement>('#frame')!;
const position = document.querySelector<HTMLOutputElement>('#position')!;
const speed = document.querySelector<HTMLSelectElement>('#speed')!;
const download = document.querySelector<HTMLAnchorElement>('#download')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const modes = document.querySelectorAll<HTMLButtonElement>('[data-mode]');
video.poster = new URL('./media/poster.jpg', import.meta.url).href;
frame.max = String(manifest.frames - 1);

function showPosition() {
  const index = Math.min(manifest.frames - 1, Math.floor(video.currentTime * manifest.fps));
  frame.value = String(index);
  position.value = `${String(index + 1).padStart(3, '0')} / ${manifest.frames}`;
}
function playbackState() {
  toggle.textContent = video.paused ? '▶' : 'Ⅱ';
  toggle.setAttribute('aria-label', video.paused ? '재생' : '일시정지');
}
async function play() {
  try { await video.play(); } catch { playbackState(); }
}
function seek(index: number) {
  video.pause();
  video.currentTime = (Math.max(0, Math.min(manifest.frames - 1, index)) + 0.1) / manifest.fps;
  showPosition();
}
let pendingSwitch: { time: number; playing: boolean } | undefined;
video.addEventListener('loadedmetadata', () => {
  video.playbackRate = Number(speed.value);
  if (pendingSwitch) {
    video.currentTime = Math.min(pendingSwitch.time, video.duration - 1 / manifest.fps);
    const shouldPlay = pendingSwitch.playing;
    pendingSwitch = undefined;
    if (shouldPlay) void play();
    else video.pause();
  }
  showPosition();
});
video.addEventListener('canplay', () => { status.textContent = ''; });
video.addEventListener('error', () => { status.textContent = '영상을 불러오지 못했어요. 페이지를 새로고침해 주세요.'; });
video.addEventListener('play', playbackState);
video.addEventListener('pause', playbackState);
video.addEventListener('timeupdate', showPosition);
video.addEventListener('seeked', showPosition);
if ('requestVideoFrameCallback' in video) {
  video.requestVideoFrameCallback(function updateFrame() {
    showPosition();
    video.requestVideoFrameCallback(updateFrame);
  });
}
toggle.addEventListener('click', () => { if (video.paused) void play(); else video.pause(); });
frame.addEventListener('input', () => seek(Number(frame.value)));
document.querySelector('#previous')!.addEventListener('click', () => seek(Number(frame.value) - 1));
document.querySelector('#next')!.addEventListener('click', () => seek(Number(frame.value) + 1));
speed.addEventListener('change', () => { video.playbackRate = Number(speed.value); });
for (const button of modes) {
  button.addEventListener('click', () => {
    if (button.getAttribute('aria-pressed') === 'true') return;
    const mode = button.dataset.mode as keyof typeof sources;
    pendingSwitch = { time: video.currentTime, playing: !video.paused };
    video.autoplay = pendingSwitch.playing;
    for (const item of modes) item.setAttribute('aria-pressed', String(item === button));
    video.src = sources[mode];
    download.href = sources[mode];
    download.download = `runway-${mode}.mp4`;
    status.textContent = '영상을 불러오는 중…';
  });
}
if (matchMedia('(prefers-reduced-motion: reduce)').matches) video.autoplay = false;
video.src = sources.frame;
download.href = sources.frame;
playbackState();
