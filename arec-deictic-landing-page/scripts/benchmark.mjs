#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkFiles } from './walk-files.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const benchmarkRoot = resolve(here, '..');
const protocol = JSON.parse(await readFile(join(benchmarkRoot, 'protocol.json'), 'utf8'));

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${command} exited ${code ?? signal}`));
    });
  });
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function verifyPreregistration() {
  const expected = (await readFile(join(benchmarkRoot, 'preregistration.sha256'), 'utf8')).trim().split(/\s+/)[0];
  const actual = await sha256(join(benchmarkRoot, 'preregistration.md'));
  if (expected !== actual) throw new Error(`Preregistration checksum mismatch: expected ${expected}, got ${actual}`);
  console.log(`Preregistration verified: ${actual}`);
}

async function validateConditions() {
  const manifest = JSON.parse(await readFile(join(benchmarkRoot, 'conditions/manifest.json'), 'utf8'));
  if (!manifest.source.synthetic) throw new Error('Source is not labeled synthetic');
  const expectedEvidenceFiles = {
    raw_video: ['README.md', 'relay-design-review.mp4'],
    transcript_only: ['README.md', 'transcript.txt'],
    clipy_arec: [
      'README.md',
      'moments/assurance-motion-crop.jpg',
      'moments/assurance-motion-frame.jpg',
      'moments/assurance-motion-target-frame.jpg',
      'moments/cta-state-crop.jpg',
      'moments/cta-state-frame.jpg',
      'moments/headline-note-crop.jpg',
      'moments/headline-note-frame.jpg',
      'moments/mobile-nav-crop.jpg',
      'moments/mobile-nav-frame.jpg',
      'moments/mobile-overflow-crop.jpg',
      'moments/mobile-overflow-frame.jpg',
      'moments/primary-cta-crop.jpg',
      'moments/primary-cta-frame.jpg',
      'recording.arec',
    ],
    complete_spec: ['README.md', 'specification.txt'],
  };
  const baseFiles = await walkFiles(join(benchmarkRoot, 'fixture/base'));
  for (const arm of protocol.arms) {
    const fixture = join(benchmarkRoot, 'conditions', arm);
    await run('npm', ['test'], { cwd: fixture });
    const evidenceRoot = join(fixture, 'evidence');
    const actualEvidenceFiles = (await walkFiles(evidenceRoot))
      .map((path) => path.slice(evidenceRoot.length + 1))
      .sort();
    if (JSON.stringify(actualEvidenceFiles) !== JSON.stringify(expectedEvidenceFiles[arm])) {
      throw new Error(`Unexpected evidence inventory for ${arm}: ${actualEvidenceFiles.join(', ')}`);
    }
    for (const file of manifest.conditions[arm]) {
      const path = join(fixture, 'evidence', file.path);
      const [digest, info] = await Promise.all([sha256(path), stat(path)]);
      if (digest !== file.sha256 || info.size !== file.bytes) throw new Error(`Condition checksum mismatch: ${arm}/${file.path}`);
    }
    for (const basePath of baseFiles) {
      const relativePath = basePath.slice(join(benchmarkRoot, 'fixture/base').length + 1);
      const conditionPath = join(fixture, relativePath);
      if (await sha256(basePath) !== await sha256(conditionPath)) {
        throw new Error(`Fixture drift between base and ${arm}: ${relativePath}`);
      }
    }
  }
  const rawFiles = await walkFiles(join(benchmarkRoot, 'conditions/raw_video/evidence'));
  const transcriptFiles = await walkFiles(join(benchmarkRoot, 'conditions/transcript_only/evidence'));
  if (rawFiles.some((file) => /transcript|\.jpe?g$|\.png$|\.arec$/i.test(file))) throw new Error('Raw arm has forbidden derived evidence');
  if (transcriptFiles.some((file) => /\.jpe?g$|\.png$|\.mp4$|\.arec$/i.test(file))) throw new Error('Transcript arm has forbidden visual/structured evidence');
  const specFiles = await walkFiles(join(benchmarkRoot, 'conditions/complete_spec/evidence'));
  if (specFiles.some((file) => /transcript|\.jpe?g$|\.png$|\.mp4$|\.arec$/i.test(file))) throw new Error('Complete-spec arm has forbidden recording-derived evidence');
  console.log('All condition packages match the manifest and leakage rules.');
}

function primarySchedule() {
  const counts = Object.fromEntries(protocol.arms.map((arm) => [arm, 0]));
  return protocol.schedule.flatMap((row) => row.map((arm) => ({ arm, replicate: ++counts[arm] })));
}

async function runTrials(args) {
  if (args.includes('--all')) {
    await verifyPreregistration();
    await validateConditions();
    for (const trial of primarySchedule()) {
      const output = join(benchmarkRoot, 'results/trials', `trial-${String(trial.replicate).padStart(2, '0')}-${trial.arm}`, 'metadata.json');
      try {
        await stat(output);
        console.log(`Skipping completed ${trial.arm} replicate ${trial.replicate}`);
        continue;
      } catch {
        // Run the next scheduled trial.
      }
      await run(process.execPath, [join(here, 'run-trial.mjs'), '--arm', trial.arm, '--replicate', String(trial.replicate)]);
    }
    return;
  }
  const arm = args[args.indexOf('--arm') + 1];
  const replicate = args[args.indexOf('--replicate') + 1];
  const pilot = args.includes('--pilot');
  await run(process.execPath, [join(here, 'run-trial.mjs'), '--arm', arm, '--replicate', replicate, ...(pilot ? ['--pilot'] : [])]);
}

async function gradeAll() {
  const trialsRoot = join(benchmarkRoot, 'results/trials');
  const trialNames = (await readdir(trialsRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const blinding = {};
  const evaluationIdPattern = /^eval-[a-f0-9]{12}$/;
  const blindingPath = join(benchmarkRoot, 'results/blinding-map.json');
  let originalBlinding = null;
  try {
    originalBlinding = await readFile(blindingPath, 'utf8');
    Object.assign(blinding, JSON.parse(originalBlinding));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // Create the frozen map on first grading pass.
  }
  for (const [trialName, evaluationId] of Object.entries(blinding)) {
    if (!trialNames.includes(trialName) || !evaluationIdPattern.test(evaluationId)) {
      throw new Error(`Invalid blinding-map entry: ${trialName}`);
    }
  }
  const assignedIds = new Set(Object.values(blinding));
  for (const trialName of trialNames) {
    const metadata = JSON.parse(await readFile(join(trialsRoot, trialName, 'metadata.json'), 'utf8'));
    if (
      metadata.infrastructureFailure
      || metadata.leakageDetected
      || metadata.secretLeakDetected
      || metadata.hostMaterialDetected
      || metadata.unsafeSubmissionDetected
    ) {
      delete blinding[trialName];
      continue;
    }
    if (!blinding[trialName]) {
      let evaluationId;
      do evaluationId = `eval-${randomBytes(6).toString('hex')}`;
      while (assignedIds.has(evaluationId));
      blinding[trialName] = evaluationId;
      assignedIds.add(evaluationId);
    }
  }

  const stagingRoot = join(benchmarkRoot, 'results/.grading-staging');
  const stagedSubmissionsRoot = join(stagingRoot, 'submissions');
  const stagedEvaluationsRoot = join(stagingRoot, 'evaluations');
  const stagedBlindingPath = join(stagingRoot, 'blinding-map.json');
  const previousEvaluationsRoot = join(stagingRoot, 'previous-evaluations');
  const evaluationsRoot = join(benchmarkRoot, 'results/evaluations');
  let published = false;
  await rm(stagingRoot, { recursive: true, force: true });
  await mkdir(stagedEvaluationsRoot, { recursive: true });
  await writeFile(stagedBlindingPath, `${JSON.stringify(blinding, null, 2)}\n`);
  await rm(blindingPath, { force: true });
  try {
    for (const trialName of trialNames) {
      const evaluationId = blinding[trialName];
      if (!evaluationId) continue;
      const output = join(stagedEvaluationsRoot, evaluationId);
      const stagedSubmission = join(stagedSubmissionsRoot, evaluationId, 'submission');
      await mkdir(output, { recursive: true });
      await cp(join(trialsRoot, trialName, 'submission'), stagedSubmission, { recursive: true });
      await run(process.execPath, [
        join(here, 'grade-submission.mjs'),
        stagedSubmission,
        output,
        evaluationId,
      ]);
    }

    let previousEvaluationsMoved = false;
    let stagedEvaluationsPublished = false;
    try {
      try {
        await rename(evaluationsRoot, previousEvaluationsRoot);
        previousEvaluationsMoved = true;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      await rename(stagedEvaluationsRoot, evaluationsRoot);
      stagedEvaluationsPublished = true;
      await rename(stagedBlindingPath, blindingPath);
      if (previousEvaluationsMoved) {
        await rm(previousEvaluationsRoot, { recursive: true, force: true });
      }
    } catch (error) {
      if (stagedEvaluationsPublished) {
        await rm(evaluationsRoot, { recursive: true, force: true });
      }
      if (previousEvaluationsMoved) {
        await rename(previousEvaluationsRoot, evaluationsRoot);
      }
      throw error;
    }
    published = true;
  } finally {
    if (!published) {
      if (originalBlinding == null) await rm(blindingPath, { force: true });
      else await writeFile(blindingPath, originalBlinding);
    }
    await rm(stagingRoot, { recursive: true, force: true });
  }
  console.log(`Graded ${Object.keys(blinding).length} submissions without arm labels.`);
}

async function verifyIsolation() {
  await run(process.execPath, [
    join(here, 'run-trial.mjs'),
    '--arm', 'transcript_only',
    '--replicate', 'isolation',
    '--pilot',
    '--verify-isolation',
  ], {
    env: { ...process.env, BENCHMARK_SECRET_SENTINEL: 'must-not-reach-the-trial' },
  });
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case 'prepare':
    await run(process.execPath, [join(here, 'prepare-fixture.mjs')]);
    break;
  case 'verify-preregistration':
    await verifyPreregistration();
    break;
  case 'validate-conditions':
    await validateConditions();
    break;
  case 'verify-isolation':
    await verifyIsolation();
    break;
  case 'verify-artifact-privacy':
    await run(process.execPath, [join(here, 'verify-artifact-privacy.mjs')]);
    break;
  case 'run':
    await runTrials(args);
    break;
  case 'grade':
    if (!args.includes('--all')) throw new Error('Only grade --all is supported');
    await gradeAll();
    break;
  case 'report':
    await run(process.execPath, [join(here, 'generate-report.mjs')]);
    break;
  default:
    throw new Error('usage: benchmark.mjs prepare|verify-preregistration|validate-conditions|verify-isolation|verify-artifact-privacy|run|grade|report');
}
