import { test, expect, vi } from 'vitest';
import manifest from './assets/quality/manifest.json';

test('enhanced-only playback waits for all photos and continues through direction changes', async () => {
  const handlers = new Map<string, (event: any) => void>();
  const nodes = new Map<string, any>();
  const context = { setTransform() {}, clearRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, drawImage: vi.fn() };
  const node = (id: string): any => {
    if (!nodes.has(id)) nodes.set(id, { dataset: {}, style: { setProperty() {} }, hidden: false,
      setAttribute() {}, getContext: () => context, addEventListener: (name: string, callback: any) => handlers.set(`${id}:${name}`, callback) });
    return nodes.get(id);
  };
  let nextFrame: ((time: number) => void) | undefined;
  const requests: string[] = [];
  const body = { dataset: { booting: 'true' } };
  vi.stubGlobal('document', { body, hidden: false, querySelector: node, getElementById: (id: string) => node(`#${id}`), addEventListener() {} });
  vi.stubGlobal('window', { addEventListener() {}, setTimeout });
  vi.stubGlobal('location', { search: '', reload() {} });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => { nextFrame = callback; });
  vi.stubGlobal('fetch', async (url: string) => { requests.push(url); return { ok: true, blob: async () => new Blob(['image']) }; });
  vi.stubGlobal('createImageBitmap', async () => ({ width: 768, height: 1152, close() {} }));
  async function until(check: () => boolean) {
    for (let i = 0; i < 200; i++) {
      if (check()) return;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('Playback did not become ready');
  }
  try {
    await import('./angle');
    expect(body.dataset.booting).toBe('true');
    await until(() => body.dataset.booting === 'false');
    expect(requests).toHaveLength(manifest.frames.length);
    expect(requests.every(url => url.includes('/assets/quality/') && url.includes('.webp'))).toBe(true);
    const canvas = node('#person');
    expect(canvas.dataset.quality).toBe('enhanced');
    let time = 100;
    nextFrame!(time);
    for (let i = 0; i < 90; i++) {
      time += 41; nextFrame!(time);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    expect(Number(canvas.dataset.clock)).toBeGreaterThan(80);
    expect(canvas.dataset.decodeWaits).toBeUndefined();
    for (let i = 0; i < 18; i++) {
      handlers.get('#surface:keydown')!({ key: 'ArrowRight', preventDefault() {} });
      await until(() => canvas.dataset.requestedYaw === String((i + 1) * 5) && canvas.dataset.directionLoading === 'false');
    }
    expect(canvas.dataset.requestedYaw).toBe('90');
    for (let i = 0; i < 36; i++) {
      handlers.get('#surface:keydown')!({ key: 'ArrowLeft', preventDefault() {} });
      await until(() => canvas.dataset.requestedYaw === String(85 - i * 5) && canvas.dataset.directionLoading === 'false');
    }
    expect(canvas.dataset.requestedYaw).toBe('-90');
    expect(requests).toHaveLength(manifest.frames.length);
    expect(context.drawImage).toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); vi.resetModules(); }
}, 30000);
