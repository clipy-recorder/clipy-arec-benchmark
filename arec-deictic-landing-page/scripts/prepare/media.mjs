import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { run } from './utils.mjs';

export async function generateNarration(config) {
  const audioRoot = join(config.generatedRoot, 'audio');
  await mkdir(audioRoot, { recursive: true });
  const inputs = [];
  const filters = [];
  for (const [index, segment] of config.timeline.segments.entries()) {
    const path = join(audioRoot, `segment-${String(index + 1).padStart(2, '0')}.aiff`);
    await run('/usr/bin/say', ['-v', 'Samantha', '-r', '205', '-o', path, segment.text]);
    inputs.push('-i', path);
    filters.push(`[${index}:a]adelay=${Math.round(segment.startSeconds * 1000)}:all=1[a${index}]`);
  }
  const mixInputs = config.timeline.segments.map((_, index) => `[a${index}]`).join('');
  const output = join(config.generatedRoot, 'narration.m4a');
  await run('ffmpeg', [
    '-y', ...inputs,
    '-filter_complex',
    `${filters.join(';')};${mixInputs}amix=inputs=${config.timeline.segments.length}:duration=longest:normalize=0,apad=pad_dur=${config.timeline.durationSeconds}[out]`,
    '-map', '[out]',
    '-t', String(config.timeline.durationSeconds),
    '-c:a', 'aac',
    '-b:a', '128k',
    output,
  ]);
  return output;
}
export async function muxRecording(config) {
  const output = join(config.generatedRoot, 'relay-design-review.mp4');
  await run('ffmpeg', [
    '-y',
    '-i', config.browserVideoPath,
    '-i', config.narrationPath,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '24',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    '-t', String(config.timeline.durationSeconds),
    output,
  ]);
  return output;
}

function cropFilter(sample, frameSize) {
  const width = 520;
  const height = 320;
  const centerX = Math.round(sample.x * frameSize.width);
  const centerY = Math.round(sample.y * frameSize.height);
  const left = Math.max(0, Math.min(frameSize.width - width, centerX - width / 2));
  const top = Math.max(0, Math.min(frameSize.height - height, centerY - height / 2));
  return `crop=${width}:${height}:${Math.round(left)}:${Math.round(top)}`;
}

export async function extractEvidence(config) {
  const momentsRoot = join(config.generatedRoot, 'moments');
  await mkdir(momentsRoot, { recursive: true });
  const cursor = JSON.parse(await readFile(config.cursorPath, 'utf8'));
  const samples = new Map(cursor.samples.map((sample) => [sample.id, sample]));
  for (const moment of config.timeline.moments) {
    const sample = samples.get(moment.id);
    if (!sample) throw new Error(`Missing cursor sample for ${moment.id}`);
    const seconds = (moment.tMs / 1000).toFixed(3);
    await run('ffmpeg', [
      '-y', '-ss', seconds, '-i', config.videoPath,
      '-frames:v', '1', '-q:v', '3',
      join(momentsRoot, `${moment.id}-frame.jpg`),
    ]);
    await run('ffmpeg', [
      '-y', '-ss', seconds, '-i', config.videoPath,
      '-vf', cropFilter(sample, config.timeline.viewport),
      '-frames:v', '1', '-q:v', '3',
      join(momentsRoot, `${moment.id}-crop.jpg`),
    ]);
    if (sample.targetTMs) {
      await run('ffmpeg', [
        '-y', '-ss', (sample.targetTMs / 1000).toFixed(3), '-i', config.videoPath,
        '-frames:v', '1', '-q:v', '3',
        join(momentsRoot, `${moment.id}-target-frame.jpg`),
      ]);
    }
  }
  return momentsRoot;
}
