import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function run(command, args, options = {}) {
  return execFileAsync(command, args, {
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
}
export function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

export async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

export function listen(server) {
  return new Promise((resolveListen) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Fixture server did not bind TCP');
      resolveListen(`http://127.0.0.1:${address.port}/`);
    });
  });
}

export function closeServer(server) {
  return new Promise((resolveClose) => server.close(resolveClose));
}
