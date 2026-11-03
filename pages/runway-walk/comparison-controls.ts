import GUI from 'lil-gui';
export type PhotoVersion = 'enhanced' | 'original';

export function comparisonControls(change: (version: PhotoVersion) => Promise<void>, playing: boolean, play: (value: boolean) => void) {
  const gui = new GUI({ title: '사진 비교', width: 220 });
  gui.domElement.setAttribute('data-touch-pointer-ignore', '');
  const options = { version: 'enhanced' as PhotoVersion, playing };
  const controller = gui.add(options, 'version', { '보정 후': 'enhanced', '보정 전': 'original' })
    .name('사진').onChange((version: PhotoVersion) => { void change(version); });
  const playback = gui.add(options, 'playing').name('재생').onChange(play);
  return {
    playback(value: boolean) { options.playing = value; playback.updateDisplay(); },
    pending(value: boolean) { controller.name(value ? '사진 · 준비 중' : '사진'); },
    progress(percent: number) { controller.name(`사진 · 원본 ${percent}%`); },
    failed() { controller.name('사진 · 다시 선택'); },
    selected(version: PhotoVersion) { options.version = version; controller.updateDisplay(); },
  };
}
