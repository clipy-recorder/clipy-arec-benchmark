import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

function requirementVector(grader, field) {
  return Object.fromEntries(grader.requirements.map((requirement) => [requirement.id, requirement[field]]));
}

function unchangedProjection(grader) {
  return {
    maximumFunctionalScore: grader.maximumFunctionalScore,
    behaviorPoints: requirementVector(grader, 'behaviorPoint'),
    smoke: grader.smoke,
    regressionFailures: grader.regressionFailures,
    unsupportedAssumptions: grader.unsupportedAssumptions,
    changedFiles: grader.changedFiles,
    observed: grader.observed,
    accessibility: grader.accessibility,
    visual: grader.visual,
  };
}

export function compareEvaluatorCorrection({ rows, initialGraders, correctedGraders, correctionCommit }) {
  const records = [];
  for (const row of rows) {
    const initial = initialGraders.get(row.evaluationId);
    const corrected = correctedGraders.get(row.evaluationId);
    if (!initial || !corrected) throw new Error(`Missing evaluator correction pair: ${row.evaluationId}`);
    if (initial.evaluationId !== corrected.evaluationId || corrected.evaluationId !== row.evaluationId) {
      throw new Error(`Opaque evaluation ID changed during correction: ${row.evaluationId}`);
    }
    if (JSON.stringify(unchangedProjection(initial)) !== JSON.stringify(unchangedProjection(corrected))) {
      throw new Error(`Non-source evaluator evidence changed during correction: ${row.evaluationId}`);
    }
    const initialSource = requirementVector(initial, 'sourcePoint');
    const correctedSource = requirementVector(corrected, 'sourcePoint');
    const changedSourcePoints = Object.keys(initialSource).filter((id) => initialSource[id] !== correctedSource[id]);
    records.push({
      trialId: row.trialId,
      evaluationId: row.evaluationId,
      arm: row.arm,
      initialFunctionalScore: initial.functionalScore,
      correctedFunctionalScore: corrected.functionalScore,
      scoreDelta: corrected.functionalScore - initial.functionalScore,
      initialStrictCompletion: initial.strictCompletion,
      correctedStrictCompletion: corrected.strictCompletion,
      changedSourcePoints,
    });
  }

  const armSummaries = {};
  for (const arm of [...new Set(records.map((record) => record.arm))]) {
    const group = records.filter((record) => record.arm === arm);
    armSummaries[arm] = {
      trials: group.length,
      initialMean: group.reduce((sum, record) => sum + record.initialFunctionalScore, 0) / group.length,
      correctedMean: group.reduce((sum, record) => sum + record.correctedFunctionalScore, 0) / group.length,
      initialStrictCompletions: group.filter((record) => record.initialStrictCompletion).length,
      correctedStrictCompletions: group.filter((record) => record.correctedStrictCompletion).length,
    };
  }

  return {
    schemaVersion: 1,
    correctionCommit,
    reason: 'The initial source recognizers rejected behavior-equivalent CSS syntax.',
    rubricChanged: false,
    browserBehaviorChanged: false,
    opaqueEvaluationIdsChanged: false,
    trialsCompared: records.length,
    exactNonSourceEvidenceMatches: records.length,
    armSummaries,
    records,
  };
}

export async function loadEvaluatorCorrection({ resultsRoot, blinding, rows, correctionCommit }) {
  const initialGraders = new Map();
  const correctedGraders = new Map();
  for (const evaluationId of Object.values(blinding).sort()) {
    const [initial, corrected] = await Promise.all([
      readFile(join(resultsRoot, 'evaluations-initial-source-regex', evaluationId, 'grader.json'), 'utf8').then(JSON.parse),
      readFile(join(resultsRoot, 'evaluations', evaluationId, 'grader.json'), 'utf8').then(JSON.parse),
    ]);
    initialGraders.set(evaluationId, initial);
    correctedGraders.set(evaluationId, corrected);
  }
  return compareEvaluatorCorrection({ rows, initialGraders, correctedGraders, correctionCommit });
}
