import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildAgentContextMarkdown } from '../../../app/api/agent-context/_markdown.ts';

const here = dirname(fileURLToPath(import.meta.url));
const benchmarkRoot = resolve(here, '..');
const sourceRoot = join(benchmarkRoot, 'source');
const generatedRoot = join(sourceRoot, 'generated');
const timeline = JSON.parse(await readFile(join(sourceRoot, 'timeline.json'), 'utf8'));
const transcriptText = await readFile(join(sourceRoot, 'transcript.txt'), 'utf8');
const extracted = JSON.parse(await readFile(join(sourceRoot, 'extracted-context.json'), 'utf8'));
const cursor = JSON.parse(await readFile(join(generatedRoot, 'cursor-sidecar.json'), 'utf8'));

const segmentPattern = /^\[(\d+):(\d+)\]\s+(.+)$/;
const transcriptLines = transcriptText.trim().split('\n');
const segments = transcriptLines.map((line, index) => {
  const match = line.match(segmentPattern);
  if (!match) throw new Error(`Invalid transcript line: ${line}`);
  const next = transcriptLines[index + 1]?.match(segmentPattern);
  return {
    start: Number(match[1]) * 60 + Number(match[2]),
    end: next
      ? Number(next[1]) * 60 + Number(next[2])
      : timeline.durationSeconds,
    text: match[3],
  };
});

const samples = new Map(cursor.samples.map((sample) => [sample.id, sample]));
const moments = timeline.moments.map((moment) => {
  const sample = samples.get(moment.id);
  if (!sample) throw new Error(`Missing generated cursor sample: ${moment.id}`);
  return {
    tMs: moment.tMs,
    caption: moment.caption,
    frameUrl: `./moments/${moment.id}-frame.jpg`,
    cropUrl: `./moments/${moment.id}-crop.jpg`,
    x: sample.x,
    y: sample.y,
    source: moment.source,
    confidence: 1,
    targetX: sample.targetX ?? null,
    targetY: sample.targetY ?? null,
    targetFrameUrl: sample.targetTMs
      ? `./moments/${moment.id}-target-frame.jpg`
      : null,
    relation: sample.relation ?? null,
  };
});

const data = {
  ok: true,
  video: {
    id: 'synthetic-relay-deictic-review',
    public_id: 'synthetic-relay-deictic-review',
    name: 'Relay deictic landing-page review (synthetic benchmark)',
    access_mode: 'public',
    processing_status: 'ready',
    created_at: '2026-08-17T00:00:00.000Z',
    recording_kind: 'feedback_review',
    transcript_status: 'ready',
    key_moments_status: 'ready',
    duration_seconds: timeline.durationSeconds,
  },
  summary: {
    tldr: extracted.tldr,
    key_points: extracted.keyPoints,
    action_items: extracted.actionItems,
    model: 'fixture-authored-controlled-study',
  },
  transcript: {
    plaintext: segments.map((segment) => segment.text).join(' '),
    segments_json: JSON.stringify(segments),
    model: 'synthetic-verbatim',
    language: 'en',
    word_count: segments.flatMap((segment) => segment.text.split(/\s+/)).length,
  },
  moments,
  capture: cursor.capture,
  cursorTelemetry: 'present',
  browserDiagnostics: null,
  browserDiagnosticsStatus: 'absent',
  duration: '0:44',
  urls: {
    watch: './relay-design-review.mp4',
    arec: './recording.arec',
    markdown: './recording.arec',
    contextJson: './recording.arec',
    transcriptJson: './recording.arec',
    apiContextJson: './recording.arec',
    apiTranscriptJson: './recording.arec',
  },
};

const outputPath = process.argv[2];
if (!outputPath) throw new Error('usage: render-arec.mjs <output.arec>');
await writeFile(outputPath, buildAgentContextMarkdown(data));
