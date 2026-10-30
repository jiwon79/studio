import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** HTML always comes from the current build. Hashed JS and photographs retain
 * their existing cache policy, so a fresh entry page does not redownload them. */
export function latestRunwayPage(directory: string) {
  return async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') { next(); return; }
    const url = new URL(request.url ?? '/', 'http://localhost');
    const route = /^\/(?:pages\/)?runway-walk\/(?:(index|angle|debug|sequence|reference|pose-test)\.html)?$/.exec(url.pathname);
    if (!route) { next(); return; }
    response.setHeader('Cache-Control', 'no-store');
    if (url.searchParams.has('v')) {
      url.searchParams.delete('v');
      response.writeHead(307, { Location: url.pathname + url.search });
      response.end();
      return;
    }
    try {
      const html = await readFile(resolve(directory, `${route[1] ?? 'index'}.html`));
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': html.length,
      });
      response.end(request.method === 'HEAD' ? undefined : html);
    } catch (error) {
      response.statusCode = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 503;
      response.end();
    }
  };
}

export function runwayLatestPages(): Plugin {
  return {
    name: 'runway-latest-pages',
    configurePreviewServer(server) {
      const directory = resolve(server.config.root, server.config.build.outDir, 'pages/runway-walk');
      const middleware = latestRunwayPage(directory);
      server.middlewares.use((request, response, next) => { void middleware(request, response, next); });
    },
  };
}
