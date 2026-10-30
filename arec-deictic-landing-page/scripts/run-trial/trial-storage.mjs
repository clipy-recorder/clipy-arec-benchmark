import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

export async function prepareTrial(runtime) {
  await mkdir(join(runtime.trialRoot, 'tmp'), { recursive: true });
  await mkdir(runtime.trialRepoRoot, { recursive: true });
  await cp(join(runtime.benchmarkRoot, 'fixture/base'), runtime.trialRepoRoot, { recursive: true });
  await cp(
    join(runtime.benchmarkRoot, 'conditions', runtime.arm, 'evidence'),
    join(runtime.trialRepoRoot, 'evidence'),
    { recursive: true },
  );
}

export async function copyAuth(runtime) {
  await mkdir(runtime.codexHome, { recursive: true, mode: 0o700 });
  await cp(runtime.authPath, join(runtime.codexHome, 'auth.json'));
  try {
    await cp(
      join(runtime.codexHomeRoot, 'models_cache.json'),
      join(runtime.codexHome, 'models_cache.json'),
    );
  } catch {
    // The model catalog passed below is sufficient if no cache exists.
  }
  await cp(runtime.modelCatalog, join(runtime.codexHome, 'model_catalog.json'));
}

export async function persistTrial(runtime, artifacts, metadata, withholdSubmission) {
  await mkdir(runtime.durableRoot, { recursive: true });
  const submissionRoot = join(runtime.durableRoot, 'submission');
  const markerPath = join(runtime.durableRoot, 'submission-withheld.json');
  await Promise.all([
    rm(submissionRoot, { recursive: true, force: true }),
    rm(markerPath, { force: true }),
    rm(join(runtime.durableRoot, 'metadata.json'), { force: true }),
  ]);
  const writes = [
    writeFile(join(runtime.durableRoot, 'events.jsonl'), artifacts.stdout),
    writeFile(join(runtime.durableRoot, 'stderr.log'), artifacts.stderr),
    writeFile(join(runtime.durableRoot, 'final-answer.md'), artifacts.finalAnswer),
    writeFile(join(runtime.durableRoot, 'patch.diff'), artifacts.diff),
    writeFile(join(runtime.durableRoot, 'status.txt'), artifacts.status),
  ];
  if (withholdSubmission) {
    writes.push(writeFile(markerPath, `${JSON.stringify({ status: 'withheld', reason: 'unsafe_submission' }, null, 2)}\n`));
  } else {
    writes.push(cp(runtime.trialRepoRoot, submissionRoot, {
      recursive: true,
      filter: (source) => !source.includes('/.git') && !source.includes('/evidence'),
    }));
  }
  await Promise.all(writes);
  await writeFile(join(runtime.durableRoot, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
}
