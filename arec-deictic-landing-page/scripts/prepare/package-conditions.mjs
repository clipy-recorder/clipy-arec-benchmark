import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { walkFiles } from '../walk-files.mjs';
import { sha256 } from './utils.mjs';

const evidenceNotes = {
  raw_video: [
    '# Recording evidence',
    '',
    'This package intentionally contains only the source MP4, its checksum, and this content-type note.',
    'It contains no transcript, still frame, summary, cursor evidence, or interpretation.',
  ],
  transcript_only: [
    '# Recording evidence',
    '',
    'This package contains only the faithful timestamped speech transcript.',
    'It contains no video, frame, cursor/motion evidence, key moment, summary, action item, or visual description.',
  ],
  clipy_arec: [
    '# Recording evidence',
    '',
    'Open `recording.arec` first. Its relative image links resolve inside this evidence directory.',
    'The document was emitted by the checked-in production AREC renderer using supported v0.3-draft fields.',
    'Its synthetic extracted summary/action items are fixture-authored and frozen before trials, as disclosed in the preregistration.',
  ],
  complete_spec: [
    '# Positive-control specification',
    '',
    'This package contains only a human-written complete specification.',
    'It contains no recording, transcript, frame, cursor evidence, summary, or AREC wrapper.',
  ],
};

async function writeEvidenceNote(root, arm, extra = []) {
  await writeFile(join(root, arm, 'evidence/README.md'), `${[...evidenceNotes[arm], ...extra].join('\n')}\n`);
}

export async function packageConditions(config) {
  await rm(config.conditionsRoot, { recursive: true, force: true });
  for (const arm of config.protocol.arms) {
    await cp(config.fixtureRoot, join(config.conditionsRoot, arm), { recursive: true });
    await mkdir(join(config.conditionsRoot, arm, 'evidence'), { recursive: true });
  }

  const videoDigest = await sha256(config.videoPath);
  await cp(config.videoPath, join(config.conditionsRoot, 'raw_video/evidence/relay-design-review.mp4'));
  await writeEvidenceNote(config.conditionsRoot, 'raw_video', [
    '',
    'Content type: `video/mp4`.',
    `SHA-256: \`${videoDigest}\`.`,
  ]);

  await cp(join(config.sourceRoot, 'transcript.txt'), join(config.conditionsRoot, 'transcript_only/evidence/transcript.txt'));
  await writeEvidenceNote(config.conditionsRoot, 'transcript_only');

  await cp(config.arecPath, join(config.conditionsRoot, 'clipy_arec/evidence/recording.arec'));
  await cp(config.momentsRoot, join(config.conditionsRoot, 'clipy_arec/evidence/moments'), { recursive: true });
  await writeEvidenceNote(config.conditionsRoot, 'clipy_arec');

  await cp(join(config.sourceRoot, 'complete-spec.txt'), join(config.conditionsRoot, 'complete_spec/evidence/specification.txt'));
  await writeEvidenceNote(config.conditionsRoot, 'complete_spec');

  const manifest = {
    schemaVersion: 1,
    generatedAt: '2026-08-17T00:00:00.000Z',
    source: {
      synthetic: true,
      videoSha256: videoDigest,
      videoBytes: (await stat(config.videoPath)).size,
      durationSeconds: config.timeline.durationSeconds,
    },
    conditions: {},
  };
  for (const arm of config.protocol.arms) {
    const evidenceRoot = join(config.conditionsRoot, arm, 'evidence');
    const files = [];
    for (const path of await walkFiles(evidenceRoot)) {
      files.push({
        path: path.slice(evidenceRoot.length + 1),
        sha256: await sha256(path),
        bytes: (await stat(path)).size,
      });
    }
    manifest.conditions[arm] = files;
  }
  await writeFile(join(config.conditionsRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const transcript = await readFile(join(config.sourceRoot, 'transcript.txt'), 'utf8');
  if (transcript.includes('Move work forward without another meeting.')) {
    throw new Error('Transcript condition leaked the visual-note headline');
  }
}
