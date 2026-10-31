import { test, expect } from 'vitest';
import { PhotoDownloads } from './photo-downloads';
import { directionPages, directionPhotos } from './direction-photos';
import schedule from './reference-schedule.json';
import data from './angles.json';

test('a cold view includes its entire loop and no unrelated atlas pages', () => {
  for (const yaw of Object.keys(schedule.directions).map(Number)) {
    const ids = directionPhotos(yaw), pages = directionPages(yaw);
    expect(pages.length).toBeLessThan(data.atlases.length / 10);
    expect(new Set(pages)).toEqual(new Set(ids.map(i => data.frames[i].atlas)));
    expect(ids.length).toBeGreaterThanOrEqual(100);
  }
  expect(directionPhotos(0)).toHaveLength(114);
});
test('rapid turns cancel obsolete queued downloads and share useful in-flight pages', async () => {
  let current = true, active = 0, peak = 0;
  const started: number[] = [], finish = new Map<number, () => void>();
  const queue = new PhotoDownloads(async index => {
    started.push(index); peak = Math.max(peak, ++active);
    await new Promise<void>(resolve => finish.set(index, resolve)); active--;
    return `page-${index}`;
  }, () => {}, 1);
  const old = [1, 2, 3].map(i => queue.request(i, () => current, false));
  current = false;
  const latest = queue.request(3);
  finish.get(1)!(); await old[0];
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(started).toEqual([1, 3]);
  finish.get(3)!();
  expect(await latest).toBe('page-3');
  expect(await Promise.all(old)).toEqual(['page-1', undefined, 'page-3']);
  expect(peak).toBe(1);
  expect(await queue.request(3)).toBe('page-3');
  expect(started).toHaveLength(2);
});
test('a failed page can be retried without poisoning the shared cache', async () => {
  let attempts = 0;
  const queue = new PhotoDownloads(async () => { if (!attempts++) throw new Error('offline'); return 'ready'; }, () => {});
  await expect(queue.request(0)).rejects.toThrow('offline');
  await expect(queue.request(0)).resolves.toBe('ready');
});
