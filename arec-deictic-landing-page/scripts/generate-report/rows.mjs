import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

function commandCapability(eventsText) {
  const completedCommands = [];
  let rawTranscriptionAttempted = false;
  for (const line of eventsText.split('\n')) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    const item = event.item;
    if (item?.type !== 'command_execution') continue;
    const command = item.command ?? '';
    if (/(?:whisper|transcrib).*relay-design-review\.mp4/i.test(command)) {
      rawTranscriptionAttempted = true;
    }
    if (item.status === 'completed' && item.exit_code === 0) completedCommands.push(command);
  }
  return {
    rawFrameExtractionSucceeded: completedCommands.some((command) =>
      /ffmpeg .*relay-design-review\.mp4/i.test(command) && /(?:frame|tile|fps=|\.jpe?g|\.png)/i.test(command)),
    rawTranscriptionAttempted,
    rawTranscriptionSucceeded: completedCommands.some((command) =>
      /(?:whisper|transcrib).*relay-design-review\.mp4/i.test(command)),
    arecDocumentRead: completedCommands.some((command) => /recording\.arec/i.test(command)),
    arecMomentAssetInspected: completedCommands.some((command) =>
      /(?:identify|file|sips|open|qlmanage|view_image).*evidence\/moments/i.test(command)),
  };
}

export async function loadRows(resultsRoot, blinding) {
  const rows = [];
  for (const [trialId, evaluationId] of Object.entries(blinding).sort(([a], [b]) => a.localeCompare(b))) {
    const trialRoot = join(resultsRoot, 'trials', trialId);
    const [metadata, grader, eventsText] = await Promise.all([
      readFile(join(trialRoot, 'metadata.json'), 'utf8').then(JSON.parse),
      readFile(join(resultsRoot, 'evaluations', evaluationId, 'grader.json'), 'utf8').then(JSON.parse),
      readFile(join(trialRoot, 'events.jsonl'), 'utf8'),
    ]);
    rows.push({
      trialId,
      evaluationId,
      arm: metadata.arm,
      replicate: Number(metadata.replicate),
      functionalScore: grader.functionalScore,
      maximumFunctionalScore: grader.maximumFunctionalScore,
      strictCompletion: grader.strictCompletion,
      fixtureSmokePassed: grader.smoke.passed,
      requirementScores: Object.fromEntries(
        grader.requirements.map((requirement) => [requirement.id, requirement.score]),
      ),
      elapsedSeconds: metadata.elapsedSeconds,
      inputTokens: metadata.usage?.input_tokens ?? null,
      cachedInputTokens: metadata.usage?.cached_input_tokens ?? null,
      outputTokens: metadata.usage?.output_tokens ?? null,
      reasoningOutputTokens: metadata.usage?.reasoning_output_tokens ?? null,
      toolCallCount: metadata.toolCallCount,
      commandCallCount: metadata.commandCallCount,
      promptCount: metadata.promptCount,
      additionalPromptCount: metadata.additionalPromptCount,
      clarificationRequestCount: metadata.clarificationRequestCount,
      regressionFailures: grader.regressionFailures,
      unsupportedAssumptions: grader.unsupportedAssumptions,
      changedFiles: grader.changedFiles,
      accessibility: grader.accessibility,
      visual: grader.visual,
      rawCapability: metadata.rawCapability,
      capabilityAudit: commandCapability(eventsText),
      infrastructureFailure: metadata.infrastructureFailure,
      leakageDetected: metadata.leakageDetected,
      secretLeakDetected: metadata.secretLeakDetected,
      hostMaterialDetected: metadata.hostMaterialDetected,
      unsafeSubmissionDetected: metadata.unsafeSubmissionDetected,
    });
  }
  return rows;
}
