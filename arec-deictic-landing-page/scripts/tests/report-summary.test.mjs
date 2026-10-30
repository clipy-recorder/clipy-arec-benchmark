import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSummary } from '../generate-report/summary.mjs';

const arms = ['raw_video', 'transcript_only', 'clipy_arec', 'complete_spec'];
const requirementIds = [
  'headline', 'ctaHierarchy', 'responsiveNavigation',
  'assuranceOrder', 'mobileOverflow', 'ctaStates',
];
const protocol = {
  arms,
  primaryRecordingArms: arms.slice(0, 3),
  primaryTrialsPerArm: 5,
  runtime: { promptCount: 1 },
  bootstrapSeed: 20260817,
  bootstrapResamples: 100,
  publicationThreshold: {
    arecMinusTranscriptMeanScore: 4,
    arecMinimumStrictCompletions: 4,
    transcriptMaximumStrictCompletions: 1,
    arecMaximumMeanGapFromCompleteSpec: 1,
  },
};

function row(arm, replicate, score, strictCompletion) {
  return {
    trialId: `trial-${replicate}-${arm}`,
    arm,
    functionalScore: score,
    strictCompletion,
    fixtureSmokePassed: true,
    requirementScores: Object.fromEntries(requirementIds.map((id, index) => [id, index * 2 < score ? 2 : 0])),
    elapsedSeconds: 30 + replicate,
    inputTokens: 100,
    outputTokens: 200,
    toolCallCount: 3,
    additionalPromptCount: 0,
    clarificationRequestCount: 0,
    regressionFailures: [],
    unsupportedAssumptions: [],
    capabilityAudit: {
      rawFrameExtractionSucceeded: false,
      rawTranscriptionAttempted: false,
      rawTranscriptionSucceeded: false,
      arecDocumentRead: arm === 'clipy_arec',
      arecMomentAssetInspected: false,
    },
  };
}

test('publication decision follows every frozen threshold', () => {
  const scores = {
    raw_video: [2, 2, 4, 2, 4],
    transcript_only: [4, 6, 4, 6, 4],
    clipy_arec: [12, 12, 12, 12, 10],
    complete_spec: [12, 12, 12, 12, 12],
  };
  const rows = arms.flatMap((arm) => scores[arm].map((score, index) =>
    row(arm, index + 1, score, score === 12)));
  const built = buildSummary({
    rows,
    protocol,
    armOrder: arms,
    armLabels: Object.fromEntries(arms.map((arm) => [arm, arm])),
    integrity: { arecOrTranscriptSafetyExclusions: 0 },
  });
  assert.equal(built.summary.conclusion.evidenceSupportsPublicAdvantageClaim, true);
  assert.deepEqual(
    Object.values(built.summary.conclusion.thresholdChecks),
    [true, true, true, true, true],
  );
});

test('one failed threshold prevents the public advantage claim', () => {
  const rows = arms.flatMap((arm) => Array.from({ length: 5 }, (_, index) =>
    row(arm, index + 1, arm === 'clipy_arec' ? 10 : 8, false)));
  const built = buildSummary({
    rows,
    protocol,
    armOrder: arms,
    armLabels: Object.fromEntries(arms.map((arm) => [arm, arm])),
    integrity: { arecOrTranscriptSafetyExclusions: 0 },
  });
  assert.equal(built.summary.conclusion.evidenceSupportsPublicAdvantageClaim, false);
});
