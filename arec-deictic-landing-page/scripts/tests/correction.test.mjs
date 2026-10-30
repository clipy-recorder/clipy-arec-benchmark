import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compareEvaluatorCorrection } from '../generate-report/correction.mjs';

function grader({ score, sourcePoint, behaviorPoint = 1 }) {
  return {
    evaluationId: 'eval-000000000000',
    functionalScore: score,
    maximumFunctionalScore: 2,
    strictCompletion: score === 2,
    requirements: [{ id: 'example', sourcePoint, behaviorPoint, score }],
    smoke: { passed: true },
    regressionFailures: [],
    unsupportedAssumptions: [],
    changedFiles: ['styles.css'],
    observed: { desktop: true },
    accessibility: { passed: true },
    visual: { distance: 0 },
  };
}

test('evaluator correction records source-only score changes', () => {
  const result = compareEvaluatorCorrection({
    rows: [{ trialId: 'trial-01', evaluationId: 'eval-000000000000', arm: 'clipy_arec' }],
    initialGraders: new Map([['eval-000000000000', grader({ score: 1, sourcePoint: 0 })]]),
    correctedGraders: new Map([['eval-000000000000', grader({ score: 2, sourcePoint: 1 })]]),
    correctionCommit: 'abc123',
  });

  assert.equal(result.browserBehaviorChanged, false);
  assert.equal(result.records[0].scoreDelta, 1);
  assert.deepEqual(result.records[0].changedSourcePoints, ['example']);
  assert.equal(result.armSummaries.clipy_arec.correctedStrictCompletions, 1);
});

test('evaluator correction rejects changed behavior evidence', () => {
  assert.throws(() => compareEvaluatorCorrection({
    rows: [{ trialId: 'trial-01', evaluationId: 'eval-000000000000', arm: 'clipy_arec' }],
    initialGraders: new Map([['eval-000000000000', grader({ score: 1, sourcePoint: 0 })]]),
    correctedGraders: new Map([['eval-000000000000', grader({ score: 1, sourcePoint: 0, behaviorPoint: 0 })]]),
    correctionCommit: 'abc123',
  }), /Non-source evaluator evidence changed/);
});
