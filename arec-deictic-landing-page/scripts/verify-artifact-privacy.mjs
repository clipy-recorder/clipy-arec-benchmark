#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hostname, userInfo } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  NON_STUDY_GLOBAL_CONTENT_MARKER,
  sanitizeEventLog,
  sanitizeText,
} from './run-trial/artifact-privacy.mjs';
import { walkFiles } from './walk-files.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const resultsRoot = resolve(here, '../results');
const identity = { accountName: userInfo().username, hostname: hostname() };
const textExtensions = new Set([
  '.css', '.diff', '.html', '.js', '.json', '.jsonl', '.log', '.md', '.mjs', '.txt',
]);

const files = (await walkFiles(resultsRoot)).filter((path) => textExtensions.has(extname(path)));
const residualFiles = [];
for (const path of files) {
  const original = await readFile(path, 'utf8');
  const inspected = path.endsWith('/events.jsonl')
    ? sanitizeEventLog(original, identity)
    : sanitizeText(original, identity);
  if (inspected.value !== original) residualFiles.push(path.slice(resultsRoot.length + 1));
}
assert.deepEqual(residualFiles, [], `Unsanitized retained artifacts: ${residualFiles.join(', ')}`);

const fixtureIdentity = { accountName: 'fixture-user', hostname: 'fixture-host.invalid' };
const syntheticEvents = `${JSON.stringify({
  item: {
    command: 'sed -n 1,20p /Users/fixture-user/.agents/skills/review/SKILL.md',
    aggregated_output: 'unrelated global instructions\n',
  },
})}\n${JSON.stringify({
  item: {
    command: 'ls -l',
    aggregated_output: '-rw-r--r-- 1 fixture-user wheel 42 fixture-host.invalid\n',
  },
})}\n`;
const sanitizedFixture = sanitizeEventLog(syntheticEvents, fixtureIdentity);
assert.equal(sanitizedFixture.globalContentRedactionCount, 1);
assert.equal(sanitizedFixture.hostPathRedactionCount, 1);
assert.equal(sanitizedFixture.hostIdentityRedactionCount, 2);
assert.ok(sanitizedFixture.value.includes(NON_STUDY_GLOBAL_CONTENT_MARKER.trim()));
assert.ok(!sanitizedFixture.value.includes('unrelated global instructions'));
assert.ok(!sanitizedFixture.value.includes('/Users/fixture-user'));
assert.ok(!sanitizedFixture.value.includes('fixture-host.invalid'));
assert.equal(sanitizeText('font-family: -apple-system, sans-serif;', fixtureIdentity).value,
  'font-family: -apple-system, sans-serif;');

console.log(JSON.stringify({ retainedTextFiles: files.length, residualFiles: 0, syntheticBoundary: 'passed' }));
