import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

import { loadPlaywright } from '../playwright-module.mjs';
import { closeServer, delay, listen } from './utils.mjs';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function fixtureServer(root) {
  const resolvedRoot = resolve(root);
  return createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
    const relativePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = resolve(resolvedRoot, relativePath);
    try {
      if (!filePath.startsWith(`${resolvedRoot}${sep}`) || !statSync(filePath).isFile()) {
        throw new Error('Not a fixture file');
      }
      response.writeHead(200, {
        'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });
}

function timelineMoment(timeline, id) {
  const moment = timeline.moments.find((candidate) => candidate.id === id);
  if (!moment) throw new Error(`Missing timeline moment: ${id}`);
  return moment;
}

async function pointAt(page, selector, mode, frameSize) {
  const locator = page.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Could not locate capture target: ${selector}`);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.evaluate(({ x, y, pointerMode }) => {
    window.setCapturePointerMode(pointerMode);
    window.moveCapturePointer(x, y);
  }, { ...point, pointerMode: mode });
  return { x: point.x / frameSize.width, y: point.y / frameSize.height };
}

export async function captureBrowserVideo(config) {
  const videoDirectory = join(config.generatedRoot, 'browser-video');
  await mkdir(videoDirectory, { recursive: true });
  const server = fixtureServer(config.fixtureRoot);
  const fixtureUrl = await listen(server);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: config.timeline.viewport,
    recordVideo: { dir: videoDirectory, size: config.timeline.viewport },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const samples = [];
  let contextClosed = false;

  try {
    await page.goto(`${fixtureUrl}?capture=1`, { waitUntil: 'networkidle' });
    const startedAt = Date.now();
    const at = async (milliseconds, action) => {
      await delay(Math.max(0, milliseconds - (Date.now() - startedAt)));
      await action();
    };
    const frameSize = config.timeline.viewport;

    const headline = timelineMoment(config.timeline, 'headline-note');
    await at(2_200, async () => {
      await page.evaluate(({ text }) => {
        window.showCaptureNote(text, 960, 135);
        window.setCapturePointerMode('flare');
        window.moveCapturePointer(1120, 210);
      }, { text: headline.text });
    });
    await at(headline.tMs, async () => {
      samples.push({ id: headline.id, tMs: headline.tMs, x: 1120 / frameSize.width, y: 210 / frameSize.height, event: 'flare' });
    });
    await at(5_300, async () => page.evaluate(() => window.hideCaptureNote()));

    const primary = timelineMoment(config.timeline, 'primary-cta');
    let primaryPoint;
    await at(primary.tMs - 1_000, async () => {
      primaryPoint = await pointAt(page, primary.selector, 'flare', frameSize);
    });
    await at(primary.tMs, async () => {
      samples.push({ id: primary.id, tMs: primary.tMs, ...primaryPoint, event: 'flare' });
    });

    const navigation = timelineMoment(config.timeline, 'mobile-nav');
    let navigationPoint;
    await at(navigation.tMs - 1_000, async () => {
      navigationPoint = await pointAt(page, navigation.selector, 'flare', frameSize);
    });
    await at(navigation.tMs, async () => {
      samples.push({ id: navigation.id, tMs: navigation.tMs, ...navigationPoint, event: 'flare' });
    });

    const motion = timelineMoment(config.timeline, 'assurance-motion');
    await at(20_500, async () => {
      const source = await pointAt(page, motion.selector, 'flare', frameSize);
      samples.push({ id: motion.id, tMs: motion.tMs, ...source, event: 'flare' });
    });
    await at(23_000, async () => {
      const target = await pointAt(page, motion.targetSelector, 'flare', frameSize);
      const sample = samples.find((candidate) => candidate.id === motion.id);
      if (!sample) throw new Error('Motion source sample is missing');
      sample.targetTMs = 23_500;
      sample.targetX = target.x;
      sample.targetY = target.y;
      sample.relation = motion.relation;
    });

    const overflow = timelineMoment(config.timeline, 'mobile-overflow');
    await at(27_000, async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('#proof').scrollIntoViewIfNeeded();
    });
    await at(overflow.tMs, async () => {
      const point = await pointAt(page, overflow.selector, 'flare', frameSize);
      samples.push({ id: overflow.id, tMs: overflow.tMs, ...point, event: 'flare' });
    });

    const state = timelineMoment(config.timeline, 'cta-state');
    await at(34_000, async () => {
      await page.setViewportSize(config.timeline.viewport);
      await page.goto(`${fixtureUrl}?capture=1`, { waitUntil: 'networkidle' });
    });
    let statePoint;
    await at(state.tMs - 1_000, async () => {
      await page.locator(state.selector).hover();
      statePoint = await pointAt(page, state.selector, 'cursor', frameSize);
    });
    await at(state.tMs, async () => {
      samples.push({ id: state.id, tMs: state.tMs, ...statePoint, event: 'hover' });
    });
    await at(config.timeline.durationSeconds * 1000, async () => {});

    const cursorPath = join(config.generatedRoot, 'cursor-sidecar.json');
    await writeFile(cursorPath, `${JSON.stringify({
      schemaVersion: 1,
      synthetic: true,
      capture: config.capture,
      samples,
      note: 'Controlled telemetry generated from the actual capture actions before trials.',
    }, null, 2)}\n`);
    const video = page.video();
    await context.close();
    contextClosed = true;
    return { browserVideoPath: await video.path(), cursorPath };
  } finally {
    if (!contextClosed) await context.close();
    await browser.close();
    await closeServer(server);
  }
}
