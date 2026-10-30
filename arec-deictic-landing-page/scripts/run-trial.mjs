#!/usr/bin/env node
import { rmSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sanitizeEventLog, sanitizeText } from './run-trial/artifact-privacy.mjs';
import { summarizeJsonl } from './run-trial/event-summary.mjs';
import { executeModel, run } from './run-trial/process-execution.mjs';
import { resolveRuntime } from './run-trial/runtime.mjs';
import { minimalEnvironment, sandboxProfile, verifyIsolation } from './run-trial/sandbox-policy.mjs';
import {
  protectArtifacts,
  scanSubmission,
  stringSecrets,
} from './run-trial/secret-safety.mjs';
import { copyAuth, persistTrial, prepareTrial, sha256 } from './run-trial/trial-storage.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const benchmarkRoot = resolve(here, '..');
const runtime = await resolveRuntime(benchmarkRoot, process.argv.slice(2));
process.once('exit', () => {
  rmSync(runtime.codexHome, { recursive: true, force: true });
  rmSync(runtime.trialRoot, { recursive: true, force: true });
});

const credentialSecrets = [
  ...stringSecrets(JSON.parse(await readFile(runtime.authPath, 'utf8'))),
  runtime.routerUrl,
  ...runtime.router.pathname.split('/').filter((segment) => segment.length >= 16),
].filter(Boolean);

await prepareTrial(runtime);
await run('git', ['init', '-q'], { cwd: runtime.trialRepoRoot });
await run('git', ['add', '.'], { cwd: runtime.trialRepoRoot });
const commit = await run('git', [
  '-c', 'user.name=Benchmark',
  '-c', 'user.email=benchmark@invalid',
  'commit', '-qm', 'Seed trial fixture',
], { cwd: runtime.trialRepoRoot });
if (commit.code !== 0) throw new Error(`Could not seed trial repository: ${commit.stderr}`);

await copyAuth(runtime);
const profilePath = join(runtime.trialRoot, 'sandbox.sb');
await writeFile(profilePath, sandboxProfile(runtime), { mode: 0o600 });
const environment = minimalEnvironment(runtime.codexHome, runtime.trialRoot);

if (runtime.options['verify-isolation']) {
  await verifyIsolation(runtime, environment, profilePath, run);
  console.log('Isolation verified: minimal env, hidden and unapproved host access blocked, external network blocked, trial write and fixture validation allowed.');
  process.exit(0);
}

const startedAt = new Date();
const startedNs = process.hrtime.bigint();
const execution = await executeModel(runtime, environment, profilePath);
const elapsedSeconds = Number(process.hrtime.bigint() - startedNs) / 1_000_000_000;
const endedAt = new Date();
const [diff, status, finalAnswer] = await Promise.all([
  run('git', ['diff', '--binary', 'HEAD'], { cwd: runtime.trialRepoRoot }),
  run('git', ['status', '--short'], { cwd: runtime.trialRepoRoot }),
  readFile(execution.outputMessagePath, 'utf8').catch(() => ''),
]);

const canary = (await readFile(
  join(benchmarkRoot, 'evaluator/LEAKAGE_CANARY.txt'),
  'utf8',
)).split('\n')[0];
const submissionScan = await scanSubmission(
  runtime.trialRepoRoot,
  credentialSecrets,
  canary,
  runtime.hostIdentity,
);
const originalMaterial = [
  execution.stdout,
  execution.stderr,
  diff.stdout,
  finalAnswer,
  status.stdout,
];
const safety = protectArtifacts(originalMaterial, credentialSecrets, canary, submissionScan);
const stdout = sanitizeEventLog(safety.redact(execution.stdout), runtime.hostIdentity);
const stderr = sanitizeText(safety.redact(execution.stderr), runtime.hostIdentity);
const diffArtifact = sanitizeText(safety.redact(diff.stdout), runtime.hostIdentity);
const finalAnswerArtifact = sanitizeText(safety.redact(finalAnswer), runtime.hostIdentity);
const statusArtifact = sanitizeText(safety.redact(status.stdout), runtime.hostIdentity);
const artifacts = {
  stdout: stdout.value,
  stderr: stderr.value,
  diff: diffArtifact.value,
  finalAnswer: finalAnswerArtifact.value,
  status: statusArtifact.value,
};
const privacyResiduals = [
  sanitizeEventLog(artifacts.stdout, runtime.hostIdentity).value !== artifacts.stdout,
  ...[artifacts.stderr, artifacts.diff, artifacts.finalAnswer, artifacts.status]
    .map((value) => sanitizeText(value, runtime.hostIdentity).value !== value),
];
if (privacyResiduals.some(Boolean)) {
  throw new Error('Artifact privacy sanitization left residual host material');
}
const events = summarizeJsonl(artifacts.stdout);
const metadata = {
  schemaVersion: 1,
  runId: runtime.runId,
  pilot: Boolean(runtime.options.pilot),
  arm: runtime.arm,
  replicate: String(runtime.replicate),
  protocolBaseCommit: runtime.protocol.baseCommit,
  model: runtime.protocol.runtime.model,
  reasoningEffort: runtime.protocol.runtime.reasoningEffort,
  promptCount: 1,
  startedAt: startedAt.toISOString(),
  endedAt: endedAt.toISOString(),
  elapsedSeconds,
  exitCode: execution.completion.code,
  signal: execution.completion.signal,
  timedOut: execution.timedOut,
  leakageDetected: safety.leakageDetected,
  filesystemCanaryHitCount: submissionScan.canaryPathCount,
  secretLeakDetected: safety.secretLeakDetected,
  secretFilesystemHitCount: submissionScan.secretPathCount,
  hostMaterialDetected: submissionScan.hostMaterialPathCount > 0,
  hostMaterialFilesystemHitCount: submissionScan.hostMaterialPathCount,
  authRemovedAfterThreadStart: execution.authRemovedAfterThreadStart,
  unsafeSubmissionDetected: submissionScan.unsafeEntryCount > 0,
  unsafeSubmissionEntryCount: submissionScan.unsafeEntryCount,
  artifactRedactions: {
    hostIdentityOccurrences:
      stdout.hostIdentityRedactionCount
      + stderr.hostIdentityRedactionCount
      + diffArtifact.hostIdentityRedactionCount
      + finalAnswerArtifact.hostIdentityRedactionCount
      + statusArtifact.hostIdentityRedactionCount,
    hostPathOccurrences:
      stdout.hostPathRedactionCount
      + stderr.hostPathRedactionCount
      + diffArtifact.hostPathRedactionCount
      + finalAnswerArtifact.hostPathRedactionCount
      + statusArtifact.hostPathRedactionCount,
    nonStudyGlobalCommandOutputs: stdout.globalContentRedactionCount,
  },
  infrastructureFailure: !events.modelTurnCompleted && execution.completion.code !== 0,
  conditionManifestSha256: await sha256(join(benchmarkRoot, 'conditions/manifest.json')),
  patchBytes: Buffer.byteLength(artifacts.diff),
  additionalPromptCount: 0,
  clarificationRequestCount: (artifacts.finalAnswer.match(/\?/g) ?? []).length,
  status: artifacts.status.trim().split('\n').filter(Boolean),
  ...events,
};

await persistTrial(runtime, artifacts, metadata, safety.withholdSubmission);
await rm(runtime.codexHome, { recursive: true, force: true });
await rm(runtime.trialRoot, { recursive: true, force: true });
console.log(JSON.stringify({
  runId: runtime.runId,
  exitCode: execution.completion.code,
  elapsedSeconds,
  modelTurnCompleted: events.modelTurnCompleted,
  patchBytes: metadata.patchBytes,
}));
if (execution.completion.code !== 0 && !execution.timedOut) {
  process.exitCode = execution.completion.code ?? 1;
}
