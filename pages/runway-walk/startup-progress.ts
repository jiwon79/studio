export type PhotoLoading = { originals: number; originalTotal: number; enhanced: number; enhancedTotal: number; bytes: number };
export function photoLoadingProgress(state: PhotoLoading) {
  const total = state.originalTotal + state.enhancedTotal;
  const loaded = Math.min(state.originals, state.originalTotal) + Math.min(state.enhanced, state.enhancedTotal);
  return { total, loaded, percent: total ? Math.floor(loaded / total * 100) : 0,
    downloaded: total > 0 && loaded === total };
}

export function startupProgress(element: HTMLElement) {
  const text = (id: string, value: string) => { document.getElementById(id)!.textContent = value; };
  const progress = document.getElementById('photo-progress') as HTMLProgressElement;
  let downloaded = false;
  let prepared = false;
  return {
    update(state: PhotoLoading) {
      const result = photoLoadingProgress(state);
      downloaded = result.downloaded;
      progress.value = result.percent;
      text('loading-percent', `${result.percent}%`);
      text('loading-originals', `${state.originals.toLocaleString()} / ${state.originalTotal.toLocaleString()}장`);
      text('loading-enhanced', `${state.enhanced.toLocaleString()} / ${state.enhancedTotal.toLocaleString()}장`);
      text('loading-bytes', `${(state.bytes / 1024 ** 2).toFixed(1)} MB 받음`);
      text('loading-title', downloaded ? '재생을 준비하고 있어요' : '전체 사진을 준비하고 있어요');
      progress.setAttribute('aria-valuetext', `${result.loaded} / ${result.total}장 다운로드 완료`);
    },
    prepare(done: number, total: number) {
      prepared = total > 0 && done === total;
      text('loading-playback', `${done} / ${total}구간`);
    },
    finish() {
      if (!downloaded || !prepared) throw new Error('Cannot reveal artwork before all photographs and playback are ready');
      document.body.dataset.booting = 'false';
      element.dataset.mode = 'switch';
      element.hidden = true;
    },
    fail() {
      text('loading-title', '사진을 모두 준비하지 못했어요');
      text('loading-note', '연결을 확인한 뒤 다시 시도해 주세요.');
      (document.getElementById('loading-retry') as HTMLButtonElement).hidden = false;
      element.hidden = false;
    },
  };
}
