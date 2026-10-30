import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildArecBenchmarkClaims } from '../../../../lib/research/arecBenchmarkClaims.mjs';

const benchmarkRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = join(benchmarkRoot, '../..');
const publicRoot = join(repoRoot, 'public/research/arec-coding-benchmark');
const summary = JSON.parse(await readFile(join(publicRoot, 'summary.json'), 'utf8'));
const results = JSON.parse(await readFile(join(publicRoot, 'results.json'), 'utf8'));

function collectPresentationText(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectPresentationText);
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectPresentationText);
  }
  return [];
}

test('public outcome copy is derived from the published summary and rows', () => {
  const claims = buildArecBenchmarkClaims(summary, results);
  assert.match(claims.pageDescription, /20-trial/);
  assert.match(claims.quickAnswer, /11\.8\/12 versus 5\.8\/12/);
  assert.match(claims.quickAnswer, /4\/5 runs versus 0\/5/);
  assert.match(claims.quickAnswer, /fresh isolated sessions/);
  assert.doesNotMatch(claims.quickAnswer, /independent runs/);
  assert.match(claims.scoreSeparation, /Every AREC run beat every transcript-only run/);
  assert.equal(claims.retainedFailure.trialId, 'trial-02-clipy_arec');
});

test('changed results change the complete page outcome model without stale winner copy', () => {
  const changed = structuredClone(summary);
  changed.scoreMaximum = 14;
  changed.integrity.primaryTrialsAnalyzed = 24;
  changed.summaries.clipy_arec.n = 6;
  changed.summaries.clipy_arec.functionalScore.mean = 8;
  changed.summaries.clipy_arec.functionalScore.values = [7, 8, 8, 8, 8, 9];
  changed.summaries.clipy_arec.strictCompletion.completed = 1;
  changed.summaries.clipy_arec.strictCompletion.total = 6;
  changed.summaries.transcript_only.n = 6;
  changed.summaries.transcript_only.functionalScore.mean = 10;
  changed.summaries.transcript_only.functionalScore.values = [9, 10, 10, 10, 10, 11];
  changed.summaries.transcript_only.strictCompletion.completed = 3;
  changed.summaries.transcript_only.strictCompletion.total = 6;
  changed.summaries.raw_video.functionalScore.mean = 4;
  changed.summaries.complete_spec.functionalScore.mean = 9;
  changed.comparisons.arecMinusTranscript.functionalScore.estimate = -2;
  changed.comparisons.arecMinusTranscript.functionalScore.percentile95 = [-3, -1];
  changed.comparisons.arecMinusTranscript.elapsedSeconds.estimate = -4;
  changed.comparisons.arecMinusTranscript.outputTokens.estimate = -100;
  changed.comparisons.arecMinusCompleteSpec.functionalScore.estimate = -1;
  changed.representativeTrials.raw_video.score = 4;
  changed.representativeTrials.transcript_only.score = 10;
  changed.representativeTrials.clipy_arec.score = 8;
  changed.representativeTrials.complete_spec.score = 9;
  for (const requirement of Object.values(changed.summaries.transcript_only.requirementPassRates)) {
    requirement.total = 6;
  }
  changed.summaries.transcript_only.requirementPassRates.mobileOverflow.passes = 6;
  changed.summaries.transcript_only.requirementPassRates.headline.passes = 2;
  changed.summaries.transcript_only.requirementPassRates.responsiveNavigation.passes = 1;
  changed.summaries.transcript_only.requirementPassRates.assuranceOrder.passes = 1;
  changed.conclusion.evidenceSupportsPublicAdvantageClaim = false;

  const changedResults = structuredClone(results).map((row) => row.arm === 'clipy_arec'
    ? { ...row, functionalScore: 8, maximumFunctionalScore: 14, strictCompletion: false }
    : row);
  const claims = buildArecBenchmarkClaims(changed, changedResults);
  const presentationText = collectPresentationText(claims).join('\n');
  assert.match(presentationText, /24 PRIMARY TRIALS/);
  assert.match(presentationText, /8\.0\/14 versus 10\.0\/14/);
  assert.match(presentationText, /1\/6 runs versus 3\/6/);
  assert.match(claims.heroHeadline.text, /did not establish an AREC advantage/);
  assert.match(claims.scoreSeparation, /scores ranged/);
  assert.match(claims.conclusionHeadline, /did not establish/);
  assert.doesNotMatch(
    presentationText,
    /AREC scored 2\.0× transcript-only|SCORE ADVANTAGE|20 PRIMARY TRIALS|11\.8\/12|5\.8\/12|4\/5 runs versus 0\/5|Every AREC run beat every transcript-only run|Five runs per arm/,
  );
});

test('outcome components render the derived presentation instead of literal results', async () => {
  const componentRoot = join(repoRoot, 'components/research/arec');
  const hero = await readFile(join(componentRoot, 'ArecHero.tsx'), 'utf8');
  const resultsPage = await readFile(join(componentRoot, 'ArecResults.tsx'), 'utf8');

  assert.doesNotMatch(hero, /20 PRIMARY TRIALS|AREC scored|out of 12|11\.8|5\.8|4\/5|0\/5/);
  assert.doesNotMatch(hero, /\barecVsTranscript\b|\bscoreRatio\b/);
  assert.doesNotMatch(resultsPage, /Five runs per arm|\/12|11\.8|5\.8|4\/5|0\/5/);
  assert.doesNotMatch(resultsPage, /\barecVsTranscript\b|\bcompleteSpec\b|\bstudy\b/);
  assert.match(hero, /claims\.heroHeadline/);
  assert.match(resultsPage, /claims\.retainedFailure/);
});

test('published AREC relative watch URL resolves to the published source video', async () => {
  const arec = await readFile(join(publicRoot, 'recording.arec'), 'utf8');
  const watchPath = arec.match(/^- Watch URL: \.\/(.+)$/m)?.[1];
  assert.ok(watchPath, 'recording.arec should declare a relative Watch URL');
  const video = await readFile(join(publicRoot, watchPath));
  assert.ok(video.length > 0);
});

test('production-shaped links in the exact trial AREC resolve to public study assets', async () => {
  const config = await readFile(join(repoRoot, 'next.config.ts'), 'utf8');
  const expectedRedirects = [
    [
      '/video/synthetic-relay-deictic-review',
      '/research/arec-coding-benchmark/relay-design-review.mp4',
      'relay-design-review.mp4',
    ],
    [
      '/video/synthetic-relay-deictic-review.arec',
      '/research/arec-coding-benchmark/recording.arec',
      'recording.arec',
    ],
    [
      '/api/og/video/synthetic-relay-deictic-review/card.png',
      '/research/arec-coding-benchmark/moments/headline-note-frame.jpg',
      'moments/headline-note-frame.jpg',
    ],
  ];

  for (const [source, destination, asset] of expectedRedirects) {
    assert.match(config, new RegExp(`source: '${source.replaceAll('.', '\\.')}'`));
    assert.match(config, new RegExp(`destination: '${destination.replaceAll('.', '\\.')}'`));
    assert.ok((await readFile(join(publicRoot, asset))).length > 0);
  }
});
