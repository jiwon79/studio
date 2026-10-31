import { test, expect, vi } from 'vitest';
import { photoLoadingProgress, startupProgress } from './startup-progress';

test('download completion includes every final photograph', () => {
  const state = { loaded: 2971, total: 2972, bytes: 0 };
  expect(photoLoadingProgress(state)).toEqual({ loaded: 2971, total: 2972, percent: 99, downloaded: false });
  expect(photoLoadingProgress({ ...state, loaded: 2972 }).downloaded).toBe(true);
  expect(photoLoadingProgress({ ...state, loaded: 114 }).downloaded).toBe(false);
});

test('the artwork stays hidden until the last photo and initial playback window both finish', () => {
  const body = { dataset: { booting: 'true' } };
  vi.stubGlobal('document', { body, getElementById: () => ({ setAttribute() {}, textContent: '', value: 0 }) });
  try {
    const element = { dataset: {}, hidden: false } as unknown as HTMLElement;
    const loading = startupProgress(element);
    const state = { loaded: 2971, total: 2972, bytes: 0 };
    loading.update(state); loading.prepare(9, 9);
    expect(() => loading.finish()).toThrow();
    expect(body.dataset.booting).toBe('true');
    loading.update({ ...state, loaded: 2972 }); loading.prepare(8, 9);
    expect(() => loading.finish()).toThrow();
    loading.prepare(9, 9); loading.finish();
    expect(body.dataset.booting).toBe('false');
    expect(element.hidden).toBe(true);
    body.dataset.booting = 'true';
    const failed = startupProgress(element);
    failed.update({ ...state, loaded: 2972 }); failed.prepare(9, 9);
    failed.fail(); failed.update({ ...state, loaded: 2972 });
    expect(() => failed.finish()).toThrow();
    expect(body.dataset.booting).toBe('true');
  } finally { vi.unstubAllGlobals(); }
});
