import { test, expect, onTestFinished } from 'vitest';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { latestRunwayPage } from './latest-pages';

async function preview() {
  const directory = await mkdtemp(join(tmpdir(), 'runway-latest-'));
  const middleware = latestRunwayPage(directory);
  const server = createServer((request, response) => {
    void middleware(request, response, () => {
      response.setHeader('Cache-Control', 'public, max-age=3600');
      response.end('asset');
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  onTestFinished(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(directory, { recursive: true });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing preview address');
  return { directory, url: `http://127.0.0.1:${address.port}` };
}

test('the same page URL returns the new build even with stale conditional cache headers', async () => {
  const { directory, url } = await preview();
  const file = join(directory, 'angle.html');
  await writeFile(file, '<script src="/assets/old.js"></script>');
  const first = await fetch(`${url}/runway-walk/angle.html`);
  expect(first.headers.get('cache-control')).toBe('no-store');
  expect(await first.text()).toContain('old.js');
  await writeFile(file, '<script src="/assets/new.js"></script>');
  const latest = await fetch(`${url}/runway-walk/angle.html`, { headers: {
    'If-None-Match': '*', 'If-Modified-Since': 'Wed, 01 Jan 2098 00:00:00 GMT',
  } });
  expect(latest.status).toBe(200);
  expect(latest.headers.get('cache-control')).toBe('no-store');
  expect(await latest.text()).toContain('new.js');
  const head = await fetch(`${url}/pages/runway-walk/angle.html`, { method: 'HEAD' });
  expect(head.headers.get('cache-control')).toBe('no-store');
  expect(await head.text()).toBe('');
});

test('old version links redirect without losing the selected angle or review position', async () => {
  const { url } = await preview();
  for (const route of ['/runway-walk/angle.html', '/pages/runway-walk/sequence.html']) {
    const response = await fetch(`${url}${route}?v=23&angle=-25&tick=54&v=53`, { redirect: 'manual' });
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`${route}?angle=-25&tick=54`);
    expect(response.headers.get('cache-control')).toBe('no-store');
  }
});

test('photograph versions and unrelated artwork caches are left to the static server', async () => {
  const { url } = await preview();
  for (const route of ['/assets/angle-hash.js', '/runway-walk/media/angles/atlas.webp?v=abc', '/rose-glass/index.html?v=23']) {
    const response = await fetch(url + route, { redirect: 'manual' });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
    expect(await response.text()).toBe('asset');
  }
});
