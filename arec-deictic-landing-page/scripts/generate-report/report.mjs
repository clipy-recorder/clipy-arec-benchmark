import { round } from './stats.mjs';

const requirementLabels = {
  headline: 'Exact visual-note headline',
  ctaHierarchy: 'Flare-grounded CTA hierarchy',
  responsiveNavigation: 'Flare-grounded responsive navigation',
  assuranceOrder: 'Motion-grounded assurance order',
  mobileOverflow: 'Fully spoken mobile overflow repair',
  ctaStates: 'Hover/focus interaction behavior',
};

function signed(value, places = 1) {
  const text = value.toFixed(places);
  return value > 0 ? `+${text}` : text;
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function interval(comparison) {
  return comparison.percentile95.map((value) => round(value, 2));
}

function thresholdLine(passed) {
  return passed ? 'met' : 'not met';
}

export function renderReport(context) {
  const {
    protocol, armOrder, summaries, comparisons, capability,
    processIntegrity, representativeTrials, integrity, redaction, evaluatorCorrection, conclusion,
  } = context;
  const advantage = conclusion.evidenceSupportsPublicAdvantageClaim;
  const maximum = protocol.primaryScoreMaximum;
  const req = (arm, id) => summaries[arm].requirementPassRates[id];
  const ciTranscript = interval(comparisons.arecMinusTranscript.functionalScore);
  const ciRaw = interval(comparisons.arecMinusRaw.functionalScore);
  const ciSpec = interval(comparisons.arecMinusCompleteSpec.functionalScore);
  const redactionTotals = redaction.records.reduce((totals, record) => ({
    hostIdentity: totals.hostIdentity + record.hostIdentityOccurrences,
    hostPaths: totals.hostPaths + record.hostPathOccurrences,
    globalOutputs: totals.globalOutputs + record.nonStudyGlobalCommandOutputs,
  }), { hostIdentity: 0, hostPaths: 0, globalOutputs: 0 });
  const quickAnswer = advantage
    ? `In this controlled synthetic deictic task, Clipy AREC substantially outperformed transcript-only context. AREC averaged **${summaries.clipy_arec.functionalScore.mean.toFixed(1)}/${maximum}** with **${summaries.clipy_arec.strictCompletion.completed}/5** strict completions, versus **${summaries.transcript_only.functionalScore.mean.toFixed(1)}/${maximum}** and **${summaries.transcript_only.strictCompletion.completed}/5** for transcript-only. It also finished within the preregistered calibration distance of the complete specification. This narrow result is not evidence of universal superiority.`
    : `This controlled synthetic deictic task did not meet the preregistered threshold for an AREC advantage. AREC averaged **${summaries.clipy_arec.functionalScore.mean.toFixed(1)}/${maximum}** with **${summaries.clipy_arec.strictCompletion.completed}/5** strict completions, versus **${summaries.transcript_only.functionalScore.mean.toFixed(1)}/${maximum}** and **${summaries.transcript_only.strictCompletion.completed}/5** for transcript-only. The complete data and failed threshold checks are reported below.`;

  return `# Can structured recording evidence ground “this” and “that” for a coding agent?

**Study status:** completed synthetic exploratory study · **Date:** 2026-08-17 · **Scheduled primary trials:** 20 (5 per arm) · **Analyzed trials:** ${integrity.primaryTrialsAnalyzed} · **Model:** ${protocol.runtime.model}, ${protocol.runtime.reasoningEffort} reasoning · **Preregistered:** commit \`${integrity.preregistrationCommit}\`

## Quick answer

${quickAnswer}

This is a product-authored synthetic case study, not independent or peer-reviewed research. Every scheduled primary outcome is retained or accounted for, including AREC failures.

## What was the landing-page problem?

The fictional Relay page contained six seeded defects. The reviewer spoke naturally: “use the headline from this note,” “make this one filled,” “hide this item,” and “move this before that.” The exact referents appeared in a temporary note, Flare targets, frames, cursor coordinates, and a motion destination. One mobile-overflow request was fully spoken as an internal control.

Every trial received the same fixture, one-sentence task prompt, model, reasoning setting, timeout, tools, and validation access. Only the evidence package changed:

- **Raw video:** the 44-second H.264/AAC source recording, without transcript or derived stills.
- **Transcript only:** the faithful timestamped speech, without frames, labels, summary, or interpretation.
- **Clipy AREC:** the production-rendered AREC v0.3-draft document with that transcript, supported key moments, Flare/hover/motion telemetry, precomputed frames/crops, capture gaps, and disclosed fixture-authored summary/action items.
- **Complete specification:** a human-written list of all six outcomes, analyzed separately as the positive-control ceiling.

## What did the frozen primary score show?

| Arm | n | Mean ± sample SD | Median (range) | Strict completion | Regression-free | Mean elapsed | Mean output tokens |
|---|---:|---:|---:|---:|---:|---:|---:|
${armOrder.map((arm) => {
  const item = summaries[arm];
  return `| ${item.label} | ${item.n} | ${item.functionalScore.mean.toFixed(1)} ± ${item.functionalScore.sampleStandardDeviation.toFixed(2)} | ${item.functionalScore.median.toFixed(1)} (${item.functionalScore.min}–${item.functionalScore.max}) | ${item.strictCompletion.completed}/${item.strictCompletion.total} (${percent(item.strictCompletion.rate)}; Wilson 95% CI ${percent(item.strictCompletion.wilson95[0])}–${percent(item.strictCompletion.wilson95[1])}) | ${item.regressionFree}/${item.n} | ${item.elapsedSeconds.mean.toFixed(1)}s | ${Math.round(item.outputTokens.mean).toLocaleString()} |`;
}).join('\n')}

AREC minus transcript-only was **${signed(comparisons.arecMinusTranscript.functionalScore.estimate)} points** (seeded 10,000-resample percentile bootstrap interval ${ciTranscript[0]} to ${ciTranscript[1]}). AREC minus raw video was **${signed(comparisons.arecMinusRaw.functionalScore.estimate)} points** (${ciRaw[0]} to ${ciRaw[1]}). AREC minus complete specification was **${signed(comparisons.arecMinusCompleteSpec.functionalScore.estimate)} points** (${ciSpec[0]} to ${ciSpec[1]}). With five trials per arm, these intervals describe this sample; they are not statistical-significance claims.

![Mean functional score by evidence arm](../../benchmarks/arec-deictic-landing-page/results/functional-score.svg)

## Which requirements were recovered?

Full credit requires both the frozen source check and observed Chrome behavior.

| Requirement | Raw video | Transcript only | Clipy AREC | Complete spec |
|---|---:|---:|---:|---:|
${Object.entries(requirementLabels).map(([id, label]) =>
  `| ${label} | ${req('raw_video', id).passes}/5 | ${req('transcript_only', id).passes}/5 | ${req('clipy_arec', id).passes}/5 | ${req('complete_spec', id).passes}/5 |`).join('\n')}

## Did the preregistered public-claim threshold pass?

The benchmark could use “substantial advantage in this controlled deictic task” only if every frozen gate passed.

| Gate | Result |
|---|---|
| AREC mean advantage over transcript-only ≥ ${protocol.publicationThreshold.arecMinusTranscriptMeanScore}/${maximum} | ${thresholdLine(conclusion.thresholdChecks.minimumMeanAdvantage)} (${signed(comparisons.arecMinusTranscript.functionalScore.estimate)} points) |
| AREC strict completions ≥ ${protocol.publicationThreshold.arecMinimumStrictCompletions}/5 | ${thresholdLine(conclusion.thresholdChecks.minimumArecStrictCompletions)} (${summaries.clipy_arec.strictCompletion.completed}/5) |
| Transcript-only strict completions ≤ ${protocol.publicationThreshold.transcriptMaximumStrictCompletions}/5 | ${thresholdLine(conclusion.thresholdChecks.maximumTranscriptStrictCompletions)} (${summaries.transcript_only.strictCompletion.completed}/5) |
| AREC within ${protocol.publicationThreshold.arecMaximumMeanGapFromCompleteSpec} mean point of complete spec | ${thresholdLine(conclusion.thresholdChecks.withinCompleteSpecCeiling)} (${signed(comparisons.arecMinusCompleteSpec.functionalScore.estimate)} points) |
| No AREC/transcript safety exclusion | ${thresholdLine(conclusion.thresholdChecks.noArecOrTranscriptSafetyExclusion)} (${integrity.arecOrTranscriptSafetyExclusions}) |

**Frozen publication decision:** ${advantage ? 'the threshold passed' : 'the threshold did not pass'}.

## What did representative trials do?

Representative runs are chosen deterministically as the run closest to each arm mean, with trial ID as the tie-breaker.

| Arm | Trial | Score | Strict | Missed requirements | Regression flags |
|---|---|---:|---:|---|---|
${armOrder.map((arm) => {
  const trial = representativeTrials[arm];
  return `| ${summaries[arm].label} | \`${trial.trialId}\` | ${trial.score}/${maximum} | ${trial.strictCompletion ? 'yes' : 'no'} | ${trial.missedRequirements.join(', ') || 'none'} | ${trial.regressionFailures.join(', ') || 'none'} |`;
}).join('\n')}

## What did raw-video delivery measure?

Codex CLI ${protocol.runtime.cliVersion} exposed no direct video-attachment input in this harness. Raw runs could use local command-line tools: ${capability.rawFrameExtractionSucceeded}/5 completed a frame-extraction command, ${capability.rawTranscriptionAttempted}/5 attempted transcription, and ${capability.rawTranscriptionSucceeded}/5 completed it. The raw arm therefore measures this fixed CLI/tool workflow, not every model's native video capability.

All ${capability.arecDocumentRead}/5 AREC runs completed a command referencing the AREC document; ${capability.arecMomentAssetInspected}/5 completed an image-metadata or local-view command against its referenced moment assets. Command counts cannot prove how much evidence influenced reasoning, so they are capability/process observations only.

## How was the study isolated and graded?

The protocol, task, conditions, 20-run order, settings, exclusions, 12-point rubric, and publication rule were checksummed and committed before primary model turns. Each trial ran sequentially in a fresh standalone repository and ephemeral home under a default-deny outer sandbox. External network, host writes, process inspection, clipboard, Keychain, the benchmark, evaluator, other conditions, and prior trials were blocked.

Post-run security review found that the executed profile's read-only runtime exceptions for \`/usr\`, \`/Library\`, and \`/opt/homebrew\` were broader than necessary. No retained event command read host configuration/application-data locations, and the retained/public artifacts passed host-material and secret scans. The checked-in runner now narrows runtime reads and probes application data, preferences, \`/usr/local/etc\`, and \`/opt/homebrew/etc\`; the 20 primary trials were not rerun. Treat this as an execution-environment limitation, not as evidence that host data affected scores.

A separate post-result transcript-only diagnostic pilot completed a model turn under the hardened profile with no leakage, secret, host-material, unsafe-submission, or timeout detection. It is retained under \`results/pilots/\` and excluded from every primary result.

Safe submissions were copied without evidence packages to random opaque evaluation paths. The deterministic grader received no arm label or blinding map, never executed submission-authored code, served only canonicalized static files, blocked non-study origins, and observed desktop/mobile behavior in Chrome. Sanity controls scored the untouched fixture 0/${maximum} and the gold fixture ${maximum}/${maximum}.

### Was the evaluator changed after the first grading pass?

Yes, and both passes are retained. The first blinded pass exposed three source-check regular expressions that rejected valid equivalent CSS even when the frozen Chrome behavior check passed. The correction, frozen at commit \`${evaluatorCorrection.correctionCommit}\`, changed no task, rubric, weight, threshold, trial output, opaque ID, or browser check. All ${evaluatorCorrection.trialsCompared}/${evaluatorCorrection.trialsCompared} non-source evidence projections matched exactly between passes.

| Arm | Initial mean | Corrected mean | Initial strict | Corrected strict |
|---|---:|---:|---:|---:|
${armOrder.map((arm) => {
  const item = evaluatorCorrection.armSummaries[arm];
  return `| ${summaries[arm].label} | ${item.initialMean.toFixed(1)} | ${item.correctedMean.toFixed(1)} | ${item.initialStrictCompletions}/5 | ${item.correctedStrictCompletions}/5 |`;
}).join('\n')}

The correction record, initial evaluator outputs, and machine-readable before/after comparison are published with the study so this post-result change is auditable rather than hidden.

Integrity: ${integrity.primaryTrialsAttempted} primary attempts, ${integrity.primaryTrialsAnalyzed} analyzed, ${integrity.infrastructureFailures} infrastructure failures, ${integrity.safetyExclusions} safety exclusions, ${integrity.reruns} reruns, ${integrity.leakageDetections} canary detections, and ${integrity.secretLeakDetections} secret detections. Every analyzed trial received one prompt; there were ${processIntegrity.promptCount.additionalAcrossAnalyzedTrials} follow-up prompts and ${processIntegrity.promptCount.clarificationRequestsAcrossAnalyzedTrials} clarification requests.

Before publication, deterministic privacy handling replaced ${redactionTotals.hostPaths} account-specific path occurrences, ${redactionTotals.hostIdentity} host-identity occurrences, and ${redactionTotals.globalOutputs} outputs from unrelated global agent-content reads. The machine-readable audit is published with the results.

## What are the limitations?

1. The task was intentionally constructed around deictic references that AREC is designed to preserve; transcript-sufficient coding tasks may show little or no benefit.
2. AREC's summary and action items were fixture-authored before trials as a disclosed stand-in for successful extraction. The study measures the populated format's utility, not Clipy's hosted extraction accuracy.
3. One synthetic page, one model/version, one host/account, and five trials per arm cannot establish universal superiority or statistical significance.
4. Raw video was capability-constrained by a CLI without direct video attachment. Comparisons to tools with native video understanding may differ.
5. The smoke test was intentionally weak and identical across arms. Correctness comes from the hidden deterministic grader, not agent-visible acceptance tests.
6. Token accounting includes runtime/system overhead and caching. Timing and tokens are descriptive, not causal estimates.
7. The retained primary runs used broader read-only system-runtime sandbox exceptions than the hardened checked-in runner. No host-material access appears in events or retained artifacts, and a separate hardened diagnostic pilot completed cleanly, but the primary trials were not rerun after hardening.

## What can be concluded honestly?

${advantage
    ? `Measured fact: in this controlled deictic task, AREC exceeded transcript-only by ${signed(comparisons.arecMinusTranscript.functionalScore.estimate)} points, reached ${summaries.clipy_arec.strictCompletion.completed}/5 strict completions, and stayed ${Math.abs(comparisons.arecMinusCompleteSpec.functionalScore.estimate).toFixed(1)} point from the complete-spec mean. Interpretation: structured grounding helped this model act on ambiguous spoken references under these conditions. It does not follow that AREC beats transcripts on every task.`
    : `Measured fact: the run missed at least one frozen publication gate, so it did not establish the intended AREC advantage. The per-requirement table shows where evidence helped or failed. Interpretation must remain exploratory; no marketing claim should override the frozen outcome.`}

## Reproduction and raw artifacts

- Protocol/checksum: \`benchmarks/arec-deictic-landing-page/preregistration.md\` and \`preregistration.sha256\`
- Exact prompt/settings: \`common-task.md\` and \`protocol.json\`
- Source and conditions: \`source/\` and \`conditions/\`
- Hidden evaluator disclosed after execution: \`evaluator/\`
- Per-trial events, answers, patches, metadata, and submissions: \`results/trials/\`
- Opaque evaluator JSON/screenshots: \`results/evaluations/\`
- Initial evaluator outputs and correction audit: \`results/evaluations-initial-source-regex/\`, \`evaluator-correction.md\`, and \`results/evaluator-correction.json\`
- Joined raw data: \`results/results.json\` and \`results.csv\`
- Deterministic generator: \`node benchmarks/arec-deictic-landing-page/scripts/benchmark.mjs report\`
- Public copies: \`https://clipy.online/research/arec-coding-benchmark/arec-deictic-landing-page-artifacts.zip\` (this whole directory) and \`https://github.com/clipy-recorder/clipy-arec-benchmark\`
`;
}
