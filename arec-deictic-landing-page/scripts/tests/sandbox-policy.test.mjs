import assert from 'node:assert/strict';
import test from 'node:test';

import { minimalEnvironment, sandboxProfile } from '../run-trial/sandbox-policy.mjs';

const profile = sandboxProfile({
  codexBinary: process.execPath,
  codexHome: '/private/tmp/clipy-test/codex-home',
  router: { port: '7443' },
  trialRoot: '/private/tmp/clipy-test/trial',
});

test('sandbox runtime reads exclude host configuration and application data roots', () => {
  assert.doesNotMatch(profile, /\(allow file-read\* \(subpath "\/usr"\)\)/);
  assert.doesNotMatch(profile, /\(allow file-read\* \(subpath "\/Library"\)\)/);
  assert.doesNotMatch(profile, /\(allow file-read\* \(subpath "\/opt\/homebrew"\)\)/);
  assert.match(profile, /\(allow file-read\* \(subpath "\/usr\/bin"\)\)/);
  assert.match(profile, /\(allow file-read\* \(subpath "\/opt\/homebrew\/Cellar"\)\)/);
});

test('minimal trial PATH omits host-local configuration tool directories', () => {
  const environment = minimalEnvironment('/private/tmp/codex-home', '/private/tmp/trial');
  assert.equal(environment.PATH.split(':').includes('/usr/local/bin'), false);
});
