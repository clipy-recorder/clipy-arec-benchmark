import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { realpath } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function isInside(root, path) {
  return path === root || path.startsWith(`${root}/`);
}

export async function resolveInside(root, relativePath) {
  const path = await realpath(join(root, relativePath));
  if (!isInside(root, path)) throw new Error(`Submission path escapes its root: ${relativePath}`);
  return path;
}

export async function createStaticServer(root) {
  const resolvedRoot = await realpath(root);
  return createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
    const relativePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = join(root, relativePath);
    if (!filePath.startsWith(`${root}/`) && filePath !== join(root, 'index.html')) {
      response.writeHead(403).end();
      return;
    }

    let resolvedPath;
    try {
      resolvedPath = await realpath(filePath);
    } catch {
      response.writeHead(404).end('Not found');
      return;
    }
    if (!isInside(resolvedRoot, resolvedPath)) {
      response.writeHead(403).end();
      return;
    }

    const stream = createReadStream(resolvedPath);
    stream.once('error', () => response.writeHead(404).end('Not found'));
    stream.once('open', () => {
      response.writeHead(200, {
        'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self'; connect-src 'none'; img-src 'self' data:; script-src 'none'; style-src 'self'",
        'X-Content-Type-Options': 'nosniff',
      });
      stream.pipe(response);
    });
  });
}

export async function listen(server) {
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No server address');
  return `http://127.0.0.1:${address.port}`;
}
