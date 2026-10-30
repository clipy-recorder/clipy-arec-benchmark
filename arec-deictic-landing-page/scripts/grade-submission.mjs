#!/usr/bin/env node
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { interactiveChecks, snapshot } from './grade-submission/browser-observations.mjs';
import { measureVisuals, scoreSubmission } from './grade-submission/scoring.mjs';
import { changedFilesAgainstBase, fixtureSmoke, sourceChecks } from './grade-submission/source-analysis.mjs';
import { createStaticServer, listen, resolveInside } from './grade-submission/static-server.mjs';
import { loadPlaywright } from './playwright-module.mjs';
import { walkFiles } from './walk-files.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const benchmarkRoot = resolve(here, '..');
const goldRoot = join(benchmarkRoot, 'evaluator/gold');
const { chromium } = loadPlaywright();

async function observePages(submissionRoot, outputRoot) {
  const [submissionServer, goldServer] = await Promise.all([
    createStaticServer(submissionRoot),
    createStaticServer(goldRoot),
  ]);
  const [submissionUrl, goldUrl] = await Promise.all([listen(submissionServer), listen(goldServer)]);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' });
  const allowedOrigins = new Set([new URL(submissionUrl).origin, new URL(goldUrl).origin]);
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (allowedOrigins.has(url.origin)) await route.continue();
    else await route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  const screenshots = {
    actualDesktop: join(outputRoot, 'desktop.png'),
    actualMobile: join(outputRoot, 'mobile.png'),
    goldDesktop: join(outputRoot, 'gold-desktop.png'),
    goldMobile: join(outputRoot, 'gold-mobile.png'),
  };

  try {
    const desktop = await snapshot(page, submissionUrl, { width: 1440, height: 900 }, 'desktop', screenshots.actualDesktop);
    const mobile = await snapshot(page, submissionUrl, { width: 390, height: 844 }, 'mobile', screenshots.actualMobile);
    const interactions = await interactiveChecks(page, submissionUrl);
    const goldDesktop = await snapshot(page, goldUrl, { width: 1440, height: 900 }, 'desktop', screenshots.goldDesktop);
    const goldMobile = await snapshot(page, goldUrl, { width: 390, height: 844 }, 'mobile', screenshots.goldMobile);
    return { desktop, mobile, interactions, goldDesktop, goldMobile, screenshots };
  } finally {
    await context.close();
    await browser.close();
    await Promise.all([
      new Promise((resolveClose) => submissionServer.close(resolveClose)),
      new Promise((resolveClose) => goldServer.close(resolveClose)),
    ]);
  }
}

async function main() {
  const [submissionArg, outputArg, evaluationId] = process.argv.slice(2);
  if (!submissionArg || !outputArg || !evaluationId) {
    throw new Error('usage: grade-submission.mjs SUBMISSION OUTPUT_DIR EVALUATION_ID');
  }
  if (!/^eval-[a-f0-9]{12}$/.test(evaluationId)) throw new Error('Invalid opaque evaluation id');

  const submissionRoot = await realpath(resolve(submissionArg));
  const outputRoot = resolve(outputArg);
  await mkdir(outputRoot, { recursive: true });
  await walkFiles(submissionRoot);
  const [htmlPath, cssPath, clientPath] = await Promise.all([
    resolveInside(submissionRoot, 'index.html'),
    resolveInside(submissionRoot, 'styles.css'),
    resolveInside(submissionRoot, 'app.js'),
  ]);
  const [html, css, client, baselineHtml] = await Promise.all([
    readFile(htmlPath, 'utf8'),
    readFile(cssPath, 'utf8'),
    readFile(clientPath, 'utf8'),
    readFile(join(goldRoot, 'index.html'), 'utf8'),
  ]);
  const source = sourceChecks(html, css);
  const smoke = fixtureSmoke(html, css, client);
  const observed = await observePages(submissionRoot, outputRoot);
  const changedFiles = await changedFilesAgainstBase(submissionRoot, join(benchmarkRoot, 'fixture/base'));
  const scored = scoreSubmission({ source, ...observed, smoke, baselineHtml, changedFiles });
  const visual = await measureVisuals({
    ...observed,
    pixelDiffScript: join(here, 'pixel-diff.py'),
  });

  const result = {
    schemaVersion: 1,
    evaluationId,
    grader: 'deterministic-v1',
    functionalScore: scored.functionalScore,
    maximumFunctionalScore: 12,
    strictCompletion: scored.functionalScore === 12 && scored.regressionFailures.length === 0,
    requirements: scored.requirements,
    smoke,
    regressionFailures: scored.regressionFailures,
    unsupportedAssumptions: scored.unsupportedAssumptions,
    changedFiles,
    observed: {
      desktop: observed.desktop,
      mobile: observed.mobile,
      interactions: observed.interactions,
    },
    accessibility: scored.accessibility,
    visual,
  };
  await writeFile(join(outputRoot, 'grader.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ evaluationId, functionalScore: scored.functionalScore, strictCompletion: result.strictCompletion }));
}

await main();
