import GUI from 'lil-gui';

const samples = [
  { index: 1088, edited: new URL('./assets/gpt-zero/1088.png', import.meta.url), original: new URL('./assets/gpt-zero/1088-original.png', import.meta.url) },
  { index: 1090, edited: new URL('./assets/gpt-zero/1090.png', import.meta.url), original: new URL('./assets/gpt-zero/1090-original.png', import.meta.url) },
  { index: 1091, edited: new URL('./assets/gpt-zero/1091.png', import.meta.url), original: new URL('./assets/gpt-zero/1091-original.png', import.meta.url) },
];

/** An explicitly limited quality experiment; generated pixels are not treated
 * as motion-verified photographs. Original sequence and source IDs stay intact. */
export function gptZeroTest(onChange: () => void, faceFront: () => void) {
  const options = { enabled: false, still: false, frame: 1, state: '샘플 3/114장 · 준비 중' };
  const originals = new Map<number, ImageBitmap>(), edits = new Map<number, ImageBitmap>();
  const gui = new GUI({ title: '0° GPT 이미지 테스트', width: 270 });
  gui.add(options, 'enabled').name('GPT 보정').onChange(() => { faceFront(); onChange(); });
  gui.add(options, 'still').name('샘플 정지 비교').onChange(() => { faceFront(); onChange(); });
  gui.add(options, 'frame', 1, 3, 1).name('샘플 프레임').onChange(() => { options.still = true; faceFront(); onChange(); });
  gui.add(options, 'state').name('적용 범위').listen().disable();
  const stillController = gui.controllers[1];
  stillController.listen();
  const load = async (url: URL) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('GPT sample unavailable');
    return createImageBitmap(await response.blob());
  };
  void Promise.all(samples.map(async sample => {
    const [original, edited] = await Promise.all([load(sample.original), load(sample.edited)]);
    originals.set(sample.index, original); edits.set(sample.index, edited);
  })).then(() => { options.state = '샘플 3/114장 · 나머지는 원본'; onChange(); })
    .catch(() => { options.enabled = false; options.still = false; options.state = '샘플 로딩 실패'; onChange(); });
  return {
    still(yaw: number) {
      if (yaw !== 0 || !options.still) return;
      const index = samples[options.frame - 1].index;
      const image = (options.enabled ? edits : originals).get(index);
      return image ? { index, image, edited: options.enabled } : undefined;
    },
    replacement(yaw: number, index: number) { return yaw === 0 && options.enabled ? edits.get(index) : undefined; },
  };
}
