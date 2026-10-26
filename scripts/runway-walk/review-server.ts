import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, mkdir, appendFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import type { Plugin } from 'vite';
import { validateFeedback, type Feedback } from '../../pages/runway-walk/review-model';

/** Private preview review notebook. Photo IDs are whitelisted by the manifest. */
export function runwayReviewServer(root: string): Plugin {
  const cache = resolve(root, '.cache/runway-walk');
  const notebook = resolve(cache, 'feedback.jsonl');
  let writes = Promise.resolve();
  const pendingSources = new Map<string, Promise<Buffer>>();
  async function records(): Promise<Feedback[]> {
    try { return (await readFile(notebook, 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
  function json(response: ServerResponse, status: number, value: unknown) {
    response.statusCode = status;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify(value));
  }
  async function handle(request: IncomingMessage, response: ServerResponse, next: () => void) {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/runway-walk/')) { next(); return; }
    try {
      const manifest = JSON.parse(await readFile(resolve(root, 'pages/runway-walk/angles.json'), 'utf8'));
      const keys = new Set<string>(manifest.frames.map((f: { source: string; sourceFrame: number }) => `${f.source}:${f.sourceFrame}`));
      if (url.pathname === '/api/runway-walk/feedback') {
        if (request.method === 'GET') { await writes; json(response, 200, { records: await records() }); return; }
        if (request.method !== 'POST') { json(response, 405, { error: 'Method not allowed' }); return; }
        if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}` && request.headers.origin !== `https://${request.headers.host}`) {
          json(response, 403, { error: 'Same-origin requests only' }); return;
        }
        let body = '';
        for await (const chunk of request) {
          body += chunk.toString();
          if (Buffer.byteLength(body) > 16000) { json(response, 413, { error: 'Feedback is too long' }); return; }
        }
        const draft = validateFeedback(JSON.parse(body), keys);
        let saved: Feedback | undefined;
        // Serialize idempotency lookup and append; a double tap creates one note.
        const operation = writes.then(async () => {
          saved = (await records()).find(row => row.clientId === draft.clientId);
          if (!saved) {
            saved = { ...draft, id: randomUUID(), author: 'user', createdAt: new Date().toISOString() };
            await mkdir(cache, { recursive: true });
            await appendFile(notebook, JSON.stringify(saved)+'\n');
          }
        });
        writes = operation.catch(() => {});
        await operation;
        json(response, 201, saved);
      } else if (url.pathname === '/api/runway-walk/source' && request.method === 'GET') {
        const key = url.searchParams.get('frame') ?? '';
        if (!keys.has(key)) { json(response, 404, { error: 'Unknown photograph' }); return; }
        let pending = pendingSources.get(key);
        if (!pending) {
          pending = (async () => {
            const [source, number] = key.split(':');
            const row = manifest.sources.find((s: { id: string }) => s.id === source);
            const path = resolve(cache, 'debug-source', `${source}-${number}.jpg`);
            try { return await readFile(path); }
            catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
            const image = await new Promise<Buffer>((accept, reject) => {
              execFile('ffmpeg', ['-v','error','-ss',String(Number(number)/manifest.fps),'-i',resolve(cache,row.file),'-frames:v','1','-vf','scale=960:540','-f','image2pipe','-vcodec','mjpeg','-q:v','3','-'],
                { encoding: 'buffer', maxBuffer: 4*1024*1024, timeout: 20000 }, (error, stdout) => error ? reject(error) : accept(stdout));
            });
            await mkdir(resolve(cache,'debug-source'), { recursive: true });
            await writeFile(path, image);
            return image;
          })();
          pendingSources.set(key, pending);
        }
        try {
          const image = await pending;
          response.setHeader('Content-Type','image/jpeg');
          response.setHeader('Cache-Control','private, max-age=86400');
          response.end(image);
        } finally { pendingSources.delete(key); }
      } else json(response, 404, { error: 'Not found' });
    } catch (error) {
      json(response, error instanceof TypeError || error instanceof SyntaxError ? 400 : 503,
        { error: error instanceof TypeError ? error.message : 'Review storage or source footage unavailable' });
    }
  }
  const middleware = (request: IncomingMessage, response: ServerResponse, next: () => void) => { void handle(request,response,next); };
  return { name: 'runway-review-notebook',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}
