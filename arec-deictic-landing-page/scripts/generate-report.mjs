#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { publishReport } from './generate-report/publish.mjs';
import { renderReport } from './generate-report/report.mjs';
import { renderCsv, renderScoreSvg } from './generate-report/render.mjs';
import { loadRows } from './generate-report/rows.mjs';
import { loadEvaluatorCorrection } from './generate-report/correction.mjs';
import { round } from './generate-report/stats.mjs';
import { buildSummary } from './generate-report/summary.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const benchmarkRoot = resolve(here, '..');
const repoRoot = resolve(benchmarkRoot, '../..');
const resultsRoot = join(benchmarkRoot, 'results');
const protocol = JSON.parse(await readFile(join(benchmarkRoot, 'protocol.json'), 'utf8'));
const blinding = JSON.parse(await readFile(join(resultsRoot, 'blinding-map.json'), 'utf8'));
const redaction = JSON.parse(await readFile(join(resultsRoot, 'redaction-log.json'), 'utf8'));
const armOrder = protocol.arms;
const armLabels = {
  raw_video: 'Raw video',
  transcript_only: 'Transcript only',
  clipy_arec: 'Clipy AREC',
  complete_spec: 'Complete spec',
};

const trialMetadata = [];
const trialsRoot = join(resultsRoot, 'trials');
for (const entry of (await readdir(trialsRoot, { withFileTypes: true }))) {
  if (!entry.isDirectory()) continue;
  trialMetadata.push(JSON.parse(await readFile(join(trialsRoot, entry.name, 'metadata.json'), 'utf8')));
}
const rows = await loadRows(resultsRoot, blinding);
const correctionCommit = (await readFile(join(benchmarkRoot, 'evaluator-correction-commit.txt'), 'utf8')).trim();
const evaluatorCorrection = await loadEvaluatorCorrection({ resultsRoot, blinding, rows, correctionCommit });
const isSafetyExcluded = (item) => item.leakageDetected
  || item.secretLeakDetected
  || item.hostMaterialDetected
  || item.unsafeSubmissionDetected;
const safetyExclusions = trialMetadata.filter(isSafetyExcluded);
const integrity = {
  preregistrationSha256: (await readFile(join(benchmarkRoot, 'preregistration.sha256'), 'utf8')).trim().split(/\s+/)[0],
  preregistrationCommit: (await readFile(join(benchmarkRoot, 'preregistration-commit.txt'), 'utf8')).trim(),
  scheduledPrimaryTrials: protocol.arms.length * protocol.primaryTrialsPerArm,
  primaryTrialsAttempted: trialMetadata.length,
  primaryTrialsAnalyzed: rows.length,
  infrastructureFailures: trialMetadata.filter((item) => item.infrastructureFailure).length,
  safetyExclusions: safetyExclusions.length,
  arecOrTranscriptSafetyExclusions: safetyExclusions.filter((item) =>
    item.arm === 'clipy_arec' || item.arm === 'transcript_only').length,
  leakageDetections: trialMetadata.filter((item) => item.leakageDetected).length,
  secretLeakDetections: trialMetadata.filter((item) => item.secretLeakDetected).length,
  reruns: trialMetadata.filter((item) => String(item.replicate).includes('rerun')).length,
};
const built = buildSummary({ rows, protocol, armOrder, armLabels, integrity });
const csv = renderCsv(rows);
const svg = renderScoreSvg(built.summaries, armOrder, armLabels, protocol.primaryScoreMaximum);
const report = renderReport({
  protocol,
  armOrder,
  ...built,
  integrity,
  redaction,
  evaluatorCorrection,
  conclusion: built.summary.conclusion,
});
const reportPath = await publishReport({
  benchmarkRoot,
  repoRoot,
  resultsRoot,
  rows,
  summary: built.summary,
  csv,
  svg,
  report,
  evaluatorCorrection,
});

console.log(JSON.stringify({
  trials: rows.length,
  scoreMeans: Object.fromEntries(armOrder.map((arm) => [arm, round(built.summaries[arm].functionalScore.mean)])),
  evidenceSupportsPublicAdvantageClaim: built.summary.conclusion.evidenceSupportsPublicAdvantageClaim,
  report: reportPath.slice(repoRoot.length + 1),
}, null, 2));
