#!/usr/bin/env node
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { hostname, userInfo } from 'node:os';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sanitizeEventLog, sanitizeText } from './run-trial/artifact-privacy.mjs';
import { walkFiles } from './walk-files.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const benchmarkRoot = resolve(here, '..');
const resultsRoot = join(benchmarkRoot, 'results');
const logPath = join(resultsRoot, 'redaction-log.json');
const hostIdentity = { accountName: userInfo().username, hostname: hostname() };
const textExtensions = new Set([
  '.css', '.diff', '.html', '.js', '.json', '.jsonl', '.log', '.md', '.mjs', '.txt',
]);

async function runDirectories() {
  const roots = ['pilots', 'trials'];
  const directories = [];
  for (const root of roots) {
    const parent = join(resultsRoot, root);
    const entries = await readdir(parent, { withFileTypes: true }).catch((error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    for (const entry of entries) {
      if (entry.isDirectory()) directories.push(join(parent, entry.name));
    }
  }
  return directories.sort();
}

async function redactRun(runRoot) {
  const metadataPath = join(runRoot, 'metadata.json');
  const files = (await walkFiles(runRoot)).filter((path) =>
    path !== metadataPath && textExtensions.has(extname(path)));
  let hostPathOccurrences = 0;
  let hostIdentityOccurrences = 0;
  let nonStudyGlobalCommandOutputs = 0;
  const redactedFiles = [];

  for (const path of files) {
    const original = await readFile(path, 'utf8');
    const redacted = path.endsWith('/events.jsonl')
      ? sanitizeEventLog(original, hostIdentity)
      : sanitizeText(original, hostIdentity);
    hostIdentityOccurrences += redacted.hostIdentityRedactionCount;
    hostPathOccurrences += redacted.hostPathRedactionCount;
    nonStudyGlobalCommandOutputs += redacted.globalContentRedactionCount ?? 0;
    if (redacted.value !== original) {
      await writeFile(path, redacted.value);
    }
    if (redacted.value.includes('[REDACTED_')) {
      redactedFiles.push(relative(benchmarkRoot, path));
    }
  }

  const originalMetadata = await readFile(metadataPath, 'utf8');
  const redactedMetadata = sanitizeText(originalMetadata, hostIdentity);
  hostIdentityOccurrences += redactedMetadata.hostIdentityRedactionCount;
  hostPathOccurrences += redactedMetadata.hostPathRedactionCount;
  const metadata = JSON.parse(redactedMetadata.value);
  const previous = metadata.artifactRedactions ?? {
    hostIdentityOccurrences: 0,
    hostPathOccurrences: 0,
    nonStudyGlobalCommandOutputs: 0,
  };
  metadata.artifactRedactions = {
    hostIdentityOccurrences: (previous.hostIdentityOccurrences ?? 0) + hostIdentityOccurrences,
    hostPathOccurrences: previous.hostPathOccurrences + hostPathOccurrences,
    nonStudyGlobalCommandOutputs:
      previous.nonStudyGlobalCommandOutputs + nonStudyGlobalCommandOutputs,
  };
  const nextMetadata = `${JSON.stringify(metadata, null, 2)}\n`;
  if (nextMetadata !== originalMetadata) {
    await writeFile(metadataPath, nextMetadata);
  }
  if (nextMetadata.includes('[REDACTED_') || Object.values(metadata.artifactRedactions).some(Boolean)) {
    redactedFiles.push(relative(benchmarkRoot, metadataPath));
  }

  return {
    hostPathOccurrences: metadata.artifactRedactions.hostPathOccurrences,
    hostIdentityOccurrences: metadata.artifactRedactions.hostIdentityOccurrences,
    nonStudyGlobalCommandOutputs: metadata.artifactRedactions.nonStudyGlobalCommandOutputs,
    redactedFiles: [...new Set(redactedFiles)].sort(),
    run: relative(resultsRoot, runRoot),
  };
}

const records = [];
for (const runRoot of await runDirectories()) records.push(await redactRun(runRoot));
const log = {
  schemaVersion: 1,
  appliedAt: '2026-08-17T00:00:00.000Z',
  policy: {
    absoluteHomePaths: 'Replace the account-specific home prefix with [REDACTED_HOME].',
    hostIdentity: 'Replace host account names in ownership/uid output and the local hostname.',
    globalAgentContent:
      'Replace output from commands that read globally installed agent skills or plugins; retain the redacted command and exit status.',
    primaryOutcomeImpact: 'None. Scores, patches, timing, usage, and trial inclusion are unchanged.',
  },
  records,
};
await writeFile(logPath, `${JSON.stringify(log, null, 2)}\n`);
console.log(JSON.stringify({ runs: records.length, redactionLog: relative(benchmarkRoot, logPath) }));
