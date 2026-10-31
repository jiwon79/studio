import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import type { Plugin } from 'vite';
const compress = promisify(gzip);

/** Content-hashed bundles may stay cached across visits; HTML is still fresh.
 * Compress the large pose/schedule JS, not already-compressed photographs. */
export function fastAssets(directory: string) {
  const zipped = new Map<string, Promise<Buffer>>();
  return async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') { next(); return; }
    const url = new URL(request.url ?? '/', 'http://localhost');
    const hashed = /^\/assets\/([\w.-]+-[\w-]{8}\.(js|css|png|webp))$/.exec(url.pathname);
    if (!hashed) { next(); return; }
    const filename = resolve(directory, 'assets', hashed[1]);
    const type = hashed[2];
    const acceptsGzip = (request.headers['accept-encoding'] ?? '').split(',').some(value => {
      const [name, ...parameters] = value.trim().split(';');
      return name === 'gzip' && !parameters.some(p => /^\s*q=0(?:\.0*)?\s*$/.test(p));
    });
    try {
      let body: Buffer;
      if (acceptsGzip && (type === 'js' || type === 'css')) {
        let pending = zipped.get(filename);
        if (!pending) {
          pending = readFile(filename).then(bytes => compress(bytes, { level: 6 }));
          zipped.set(filename, pending);
          pending.catch(() => zipped.delete(filename));
        }
        body = await pending;
        response.setHeader('Content-Encoding', 'gzip');
      } else body = await readFile(filename);
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      response.setHeader('Vary', [response.getHeader('Vary'), 'Accept-Encoding'].filter(Boolean).join(', '));
      response.setHeader('Content-Type', ({ js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', png: 'image/png', webp: 'image/webp' })[type]!);
      response.setHeader('Content-Length', body.length);
      response.statusCode = 200;
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') { next(); return; }
      response.statusCode = 503; response.end();
    }
  };
}
export function runwayFastAssets(): Plugin {
  return { name: 'fast-preview-assets', configurePreviewServer(server) {
    const handler = fastAssets(resolve(server.config.root, server.config.build.outDir));
    server.middlewares.use((request, response, next) => { void handler(request, response, next); });
  } };
}
