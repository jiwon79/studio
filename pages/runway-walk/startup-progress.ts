export type PhotoLoading = { loaded: number; total: number; bytes: number };
export function photoLoadingProgress(state: PhotoLoading) {
  const loaded = Math.min(state.loaded, state.total);
  return { total: state.total, loaded, percent: state.total ? Math.floor(loaded / state.total * 100) : 0,
    downloaded: state.total > 0 && loaded === state.total };
}

export function startupProgress(element: HTMLElement) {
  const text = (id: string, value: string) => { document.getElementById(id)!.textContent = value; };
  const progress = document.getElementById('photo-progress') as HTMLProgressElement;
  let downloaded = false;
  let prepared = false;
  let failed = false;
  return {
    update(state: PhotoLoading) {
      const result = photoLoadingProgress(state);
      downloaded = result.downloaded;
      progress.value = result.percent;
      text('loading-percent', `${result.percent}%`);
      text('loading-enhanced', `${result.loaded.toLocaleString()} / ${result.total.toLocaleString()}`);
      text('loading-bytes', `${(state.bytes / 1024 ** 2).toFixed(1)} MB`);
      progress.setAttribute('aria-valuetext', `${result.loaded} / ${result.total}장 다운로드 완료`);
    },
    prepare(done: number, total: number) {
      prepared = total > 0 && done === total;
    },
    finish() {
      if (failed || !downloaded || !prepared) throw new Error('Cannot reveal artwork before all photographs and playback are ready');
      document.body.dataset.booting = 'false';
      element.hidden = true;
    },
    fail() {
      failed = true;
      document.getElementById('loading-error')!.hidden = false;
      (document.getElementById('loading-retry') as HTMLButtonElement).hidden = false;
      element.hidden = false;
    },
  };
}
