import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { walkFiles } from '../walk-files.mjs';

async function copyMomentAssets(benchmarkRoot, publicRoot) {
  const sourceRoot = join(benchmarkRoot, 'conditions/clipy_arec/evidence/moments');
  const targetRoot = join(publicRoot, 'moments');
  await mkdir(targetRoot, { recursive: true });
  for (const path of await walkFiles(sourceRoot)) {
    await copyFile(path, join(targetRoot, basename(path)));
  }
}

async function copyRepresentativeOutputs(resultsRoot, publicRoot, rows, summary) {
  const targetRoot = join(publicRoot, 'outputs');
  await mkdir(targetRoot, { recursive: true });
  for (const [arm, representative] of Object.entries(summary.representativeTrials)) {
    const row = rows.find((item) => item.trialId === representative.trialId);
    if (!row) throw new Error(`Missing representative result row: ${representative.trialId}`);
    for (const viewport of ['desktop', 'mobile']) {
      await copyFile(
        join(resultsRoot, 'evaluations', row.evaluationId, `${viewport}.png`),
        join(targetRoot, `${arm}-${viewport}.png`),
      );
    }
  }
}

export async function publishReport({
  benchmarkRoot, repoRoot, resultsRoot, rows, summary, csv, svg, report, evaluatorCorrection,
}) {
  await mkdir(resultsRoot, { recursive: true });
  await mkdir(join(repoRoot, 'docs/research'), { recursive: true });
  const publicRoot = join(repoRoot, 'public/research/arec-coding-benchmark');
  await rm(publicRoot, { recursive: true, force: true });
  await mkdir(publicRoot, { recursive: true });
  const docsPath = join(repoRoot, 'docs/research/2026-08-17-arec-deictic-coding-context-benchmark.md');
  await Promise.all([
    writeFile(join(resultsRoot, 'results.json'), `${JSON.stringify(rows, null, 2)}\n`),
    writeFile(join(resultsRoot, 'results.csv'), csv),
    writeFile(join(resultsRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`),
    writeFile(join(resultsRoot, 'evaluator-correction.json'), `${JSON.stringify(evaluatorCorrection, null, 2)}\n`),
    writeFile(join(resultsRoot, 'functional-score.svg'), svg),
    writeFile(docsPath, report),
    writeFile(join(publicRoot, 'results.json'), `${JSON.stringify(rows, null, 2)}\n`),
    writeFile(join(publicRoot, 'results.csv'), csv),
    writeFile(join(publicRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`),
    writeFile(join(publicRoot, 'evaluator-correction.json'), `${JSON.stringify(evaluatorCorrection, null, 2)}\n`),
    writeFile(join(publicRoot, 'functional-score.svg'), svg),
    copyFile(join(benchmarkRoot, 'common-task.md'), join(publicRoot, 'common-task.txt')),
    copyFile(join(benchmarkRoot, 'preregistration.md'), join(publicRoot, 'preregistration.txt')),
    copyFile(join(benchmarkRoot, 'protocol.json'), join(publicRoot, 'protocol.json')),
    copyFile(join(benchmarkRoot, 'methodology.md'), join(publicRoot, 'methodology.txt')),
    copyFile(join(benchmarkRoot, 'evaluator-correction.md'), join(publicRoot, 'evaluator-correction.txt')),
    copyFile(join(benchmarkRoot, 'LICENSES.md'), join(publicRoot, 'provenance.txt')),
    copyFile(join(benchmarkRoot, 'evaluator/rubric.json'), join(publicRoot, 'rubric.json')),
    copyFile(join(benchmarkRoot, 'conditions/manifest.json'), join(publicRoot, 'condition-manifest.json')),
    copyFile(join(resultsRoot, 'redaction-log.json'), join(publicRoot, 'redaction-log.json')),
    copyFile(join(benchmarkRoot, 'conditions/raw_video/evidence/relay-design-review.mp4'), join(publicRoot, 'relay-design-review.mp4')),
    copyFile(join(benchmarkRoot, 'conditions/transcript_only/evidence/transcript.txt'), join(publicRoot, 'transcript.txt')),
    copyFile(join(benchmarkRoot, 'conditions/clipy_arec/evidence/recording.arec'), join(publicRoot, 'recording.arec')),
    copyFile(join(benchmarkRoot, 'conditions/complete_spec/evidence/specification.txt'), join(publicRoot, 'complete-spec.txt')),
  ]);
  await copyMomentAssets(benchmarkRoot, publicRoot);
  await copyRepresentativeOutputs(resultsRoot, publicRoot, rows, summary);

  const durableFiles = (await walkFiles(benchmarkRoot)).filter((path) =>
    !path.includes('/source/generated/')
      && !path.includes('/results/.grading-staging/')
      && !path.includes('/scripts/__pycache__/')
      && !path.endsWith('/results/artifact-manifest.json'));
  const files = [];
  for (const path of durableFiles) {
    const bytes = await readFile(path);
    files.push({
      path: path.slice(benchmarkRoot.length + 1),
      bytes: (await stat(path)).size,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  await writeFile(join(resultsRoot, 'artifact-manifest.json'), `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: '2026-08-17T00:00:00.000Z',
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    files,
  }, null, 2)}\n`);
  return docsPath;
}
