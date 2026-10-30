#!/usr/bin/env node
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { captureBrowserVideo } from './prepare/capture.mjs';
import { extractEvidence, generateNarration, muxRecording } from './prepare/media.mjs';
import { packageConditions } from './prepare/package-conditions.mjs';
import { run } from './prepare/utils.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const benchmarkRoot = resolve(here, '..');
const repoRoot = resolve(benchmarkRoot, '../..');
const fixtureRoot = join(benchmarkRoot, 'fixture/base');
const sourceRoot = join(benchmarkRoot, 'source');
const generatedRoot = join(sourceRoot, 'generated');
const conditionsRoot = join(benchmarkRoot, 'conditions');
const protocol = JSON.parse(await readFile(join(benchmarkRoot, 'protocol.json'), 'utf8'));
const timeline = JSON.parse(await readFile(join(sourceRoot, 'timeline.json'), 'utf8'));
const capture = JSON.parse(await readFile(join(sourceRoot, 'capture.json'), 'utf8'));

const tsxPath = join(repoRoot, 'node_modules/.bin/tsx');
try {
  await stat(tsxPath);
} catch {
  throw new Error(`Missing ${tsxPath}. Install the repository dependencies before preparing the fixture.`);
}

await rm(generatedRoot, { recursive: true, force: true });
await mkdir(generatedRoot, { recursive: true });

const captureResult = await captureBrowserVideo({
  capture,
  fixtureRoot,
  generatedRoot,
  timeline,
});
const narrationPath = await generateNarration({ generatedRoot, timeline });
const videoPath = await muxRecording({
  browserVideoPath: captureResult.browserVideoPath,
  generatedRoot,
  narrationPath,
  timeline,
});
const momentsRoot = await extractEvidence({
  cursorPath: captureResult.cursorPath,
  generatedRoot,
  timeline,
  videoPath,
});
const arecPath = join(generatedRoot, 'relay-design-review.arec');
await run(tsxPath, [join(here, 'render-arec.mjs'), arecPath], { cwd: repoRoot });
await packageConditions({
  arecPath,
  conditionsRoot,
  fixtureRoot,
  momentsRoot,
  protocol,
  sourceRoot,
  timeline,
  videoPath,
});

console.log(JSON.stringify({
  arecPath,
  conditionsRoot,
  durationSeconds: timeline.durationSeconds,
  synthetic: true,
  videoPath,
}, null, 2));
