import { test, expect, vi } from 'vitest';
import { photoLoadingProgress, startupProgress } from './startup-progress';

test('download completion includes every direction and both original and enhanced photographs', () => {
  const state = { originals: 3006, originalTotal: 3006, enhanced: 243, enhancedTotal: 244, bytes: 0 };
  expect(photoLoadingProgress(state)).toEqual({ loaded: 3249, total: 3250, percent: 99, downloaded: false });
  expect(photoLoadingProgress({ ...state, enhanced: 244 }).downloaded).toBe(true);
  expect(photoLoadingProgress({ ...state, originals: 114, enhanced: 114 }).downloaded).toBe(false);
});

test('the artwork stays hidden until the last photo and initial playback window both finish', () => {
  const body = { dataset: { booting: 'true' } };
  vi.stubGlobal('document', { body, getElementById: () => ({ setAttribute() {}, textContent: '', value: 0 }) });
  try {
    const element = { dataset: {}, hidden: false } as unknown as HTMLElement;
    const loading = startupProgress(element);
    const state = { originals: 3006, originalTotal: 3006, enhanced: 243, enhancedTotal: 244, bytes: 0 };
    loading.update(state); loading.prepare(9, 9);
    expect(() => loading.finish()).toThrow();
    expect(body.dataset.booting).toBe('true');
    loading.update({ ...state, enhanced: 244 }); loading.prepare(8, 9);
    expect(() => loading.finish()).toThrow();
    loading.prepare(9, 9); loading.finish();
    expect(body.dataset.booting).toBe('false');
    expect(element.hidden).toBe(true);
    body.dataset.booting = 'true';
    const failed = startupProgress(element);
    failed.update({ ...state, enhanced: 244 }); failed.prepare(9, 9);
    failed.fail(); failed.update({ ...state, enhanced: 244 });
    expect(() => failed.finish()).toThrow();
    expect(body.dataset.booting).toBe('true');
  } finally { vi.unstubAllGlobals(); }
});
