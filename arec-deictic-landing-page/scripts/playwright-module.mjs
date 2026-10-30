import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export function loadPlaywright() {
  const explicit = process.env.PLAYWRIGHT_MODULE;
  if (explicit) return require(explicit);

  try {
    return require('playwright');
  } catch (localError) {
    try {
      const globalRoot = execFileSync('npm', ['root', '--global'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      const resolved = require.resolve('playwright', { paths: [globalRoot] });
      return require(resolved);
    } catch {
      throw new Error(
        'Playwright is required. Install it locally, install it globally, or set PLAYWRIGHT_MODULE to its module entrypoint.',
        { cause: localError },
      );
    }
  }
}
