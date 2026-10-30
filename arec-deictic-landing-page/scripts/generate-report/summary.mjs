import { bootstrapMeanDifference, mean, median, sampleStandardDeviation, wilson } from './stats.mjs';

function numeric(group, key) {
  return group.map((row) => row[key]).filter((value) => value != null);
}

function comparison(rows, first, second, protocol, seedOffset) {
  const values = (arm, key) => rows
    .filter((row) => row.arm === arm)
    .map((row) => row[key])
    .filter((value) => value != null);
  return {
    functionalScore: bootstrapMeanDifference(
      values(first, 'functionalScore'),
      values(second, 'functionalScore'),
      protocol.bootstrapSeed + seedOffset,
      protocol.bootstrapResamples,
    ),
    elapsedSeconds: bootstrapMeanDifference(
      values(first, 'elapsedSeconds'),
      values(second, 'elapsedSeconds'),
      protocol.bootstrapSeed + seedOffset + 1,
      protocol.bootstrapResamples,
    ),
    outputTokens: bootstrapMeanDifference(
      values(first, 'outputTokens'),
      values(second, 'outputTokens'),
      protocol.bootstrapSeed + seedOffset + 2,
      protocol.bootstrapResamples,
    ),
  };
}

function closestToMean(group, average) {
  return [...group].sort((first, second) =>
    Math.abs(first.functionalScore - average) - Math.abs(second.functionalScore - average)
      || first.trialId.localeCompare(second.trialId))[0];
}

function rankOutcome(summaries, arms) {
  const ordered = arms.map((arm) => ({ arm, score: summaries[arm].functionalScore.mean }))
    .sort((first, second) => second.score - first.score);
  const leaders = ordered.filter((item) => item.score === ordered[0].score).map((item) => item.arm);
  return leaders.length === 1 ? { status: 'winner', arms: leaders } : { status: 'tie', arms: leaders };
}

export function buildSummary({ rows, protocol, armOrder, armLabels, integrity }) {
  const summaries = {};
  for (const arm of armOrder) {
    const group = rows.filter((row) => row.arm === arm);
    if (!group.length) throw new Error(`No analyzed rows for ${arm}`);
    const scores = numeric(group, 'functionalScore');
    const completions = group.filter((row) => row.strictCompletion).length;
    const requirementPassRates = {};
    for (const id of Object.keys(group[0].requirementScores)) {
      const passes = group.filter((row) => row.requirementScores[id] === 2).length;
      requirementPassRates[id] = { passes, total: group.length, rate: passes / group.length };
    }
    summaries[arm] = {
      arm,
      label: armLabels[arm],
      n: group.length,
      functionalScore: {
        mean: mean(scores),
        median: median(scores),
        sampleStandardDeviation: sampleStandardDeviation(scores),
        min: Math.min(...scores),
        max: Math.max(...scores),
        values: scores,
      },
      strictCompletion: {
        completed: completions,
        total: group.length,
        rate: completions / group.length,
        wilson95: wilson(completions, group.length),
      },
      fixtureSmoke: {
        passed: group.filter((row) => row.fixtureSmokePassed).length,
        total: group.length,
      },
      requirementPassRates,
      elapsedSeconds: { mean: mean(numeric(group, 'elapsedSeconds')), median: median(numeric(group, 'elapsedSeconds')) },
      inputTokens: { mean: mean(numeric(group, 'inputTokens')), median: median(numeric(group, 'inputTokens')) },
      outputTokens: { mean: mean(numeric(group, 'outputTokens')), median: median(numeric(group, 'outputTokens')) },
      toolCallCount: { mean: mean(numeric(group, 'toolCallCount')), median: median(numeric(group, 'toolCallCount')) },
      regressionFree: group.filter((row) => row.regressionFailures.length === 0).length,
      unsupportedAssumptionFree: group.filter((row) => row.unsupportedAssumptions.length === 0).length,
    };
  }

  const comparisons = {
    arecMinusTranscript: comparison(rows, 'clipy_arec', 'transcript_only', protocol, 0),
    arecMinusRaw: comparison(rows, 'clipy_arec', 'raw_video', protocol, 3),
    arecMinusCompleteSpec: comparison(rows, 'clipy_arec', 'complete_spec', protocol, 6),
  };
  const rawRows = rows.filter((row) => row.arm === 'raw_video');
  const arecRows = rows.filter((row) => row.arm === 'clipy_arec');
  const capability = {
    rawVideoDirectAttachmentSupported: false,
    rawFrameExtractionSucceeded: rawRows.filter((row) => row.capabilityAudit.rawFrameExtractionSucceeded).length,
    rawTranscriptionAttempted: rawRows.filter((row) => row.capabilityAudit.rawTranscriptionAttempted).length,
    rawTranscriptionSucceeded: rawRows.filter((row) => row.capabilityAudit.rawTranscriptionSucceeded).length,
    arecDocumentRead: arecRows.filter((row) => row.capabilityAudit.arecDocumentRead).length,
    arecMomentAssetInspected: arecRows.filter((row) => row.capabilityAudit.arecMomentAssetInspected).length,
    totalPerArm: protocol.primaryTrialsPerArm,
  };
  const processIntegrity = {
    promptCount: {
      suppliedPerTrial: protocol.runtime.promptCount,
      additionalAcrossAnalyzedTrials: rows.reduce((sum, row) => sum + row.additionalPromptCount, 0),
      clarificationRequestsAcrossAnalyzedTrials: rows.reduce((sum, row) => sum + row.clarificationRequestCount, 0),
    },
    trialsWithRegressionFailures: rows.filter((row) => row.regressionFailures.length > 0).length,
    trialsWithFixtureSmokeFailures: rows.filter((row) => !row.fixtureSmokePassed).length,
    trialsWithUnsupportedAssumptions: rows.filter((row) => row.unsupportedAssumptions.length > 0).length,
  };
  const threshold = protocol.publicationThreshold;
  const thresholdChecks = {
    minimumMeanAdvantage:
      comparisons.arecMinusTranscript.functionalScore.estimate >= threshold.arecMinusTranscriptMeanScore,
    minimumArecStrictCompletions:
      summaries.clipy_arec.strictCompletion.completed >= threshold.arecMinimumStrictCompletions,
    maximumTranscriptStrictCompletions:
      summaries.transcript_only.strictCompletion.completed <= threshold.transcriptMaximumStrictCompletions,
    withinCompleteSpecCeiling:
      Math.abs(comparisons.arecMinusCompleteSpec.functionalScore.estimate) <= threshold.arecMaximumMeanGapFromCompleteSpec,
    noArecOrTranscriptSafetyExclusion: integrity.arecOrTranscriptSafetyExclusions === 0,
  };
  const evidenceSupportsPublicAdvantageClaim = Object.values(thresholdChecks).every(Boolean);
  const representativeTrials = {};
  for (const arm of armOrder) {
    const group = rows.filter((row) => row.arm === arm);
    const selected = closestToMean(group, summaries[arm].functionalScore.mean);
    representativeTrials[arm] = {
      trialId: selected.trialId,
      score: selected.functionalScore,
      strictCompletion: selected.strictCompletion,
      missedRequirements: Object.entries(selected.requirementScores)
        .filter(([, score]) => score < 2)
        .map(([id]) => id),
      regressionFailures: selected.regressionFailures,
    };
  }

  const summary = {
    schemaVersion: 1,
    studyId: protocol.studyId,
    synthetic: true,
    exploratory: true,
    generatedFromRawResults: true,
    model: protocol.runtime.model,
    reasoningEffort: protocol.runtime.reasoningEffort,
    scoreMaximum: protocol.primaryScoreMaximum,
    summaries,
    comparisons,
    capability,
    processIntegrity,
    representativeTrials,
    integrity,
    conclusion: {
      primaryScoreOutcome: rankOutcome(summaries, protocol.primaryRecordingArms),
      strictCompletionOutcome: rankOutcome(
        Object.fromEntries(armOrder.map((arm) => [arm, {
          functionalScore: { mean: summaries[arm].strictCompletion.rate },
        }])),
        protocol.primaryRecordingArms,
      ),
      thresholdChecks,
      evidenceSupportsPublicAdvantageClaim,
    },
  };
  return { summaries, comparisons, capability, processIntegrity, representativeTrials, summary };
}
