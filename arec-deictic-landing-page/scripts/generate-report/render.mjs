import { round } from './stats.mjs';

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function renderCsv(rows) {
  const requirementIds = [
    'headline', 'ctaHierarchy', 'responsiveNavigation',
    'assuranceOrder', 'mobileOverflow', 'ctaStates',
  ];
  const headers = [
    'trial_id', 'evaluation_id', 'arm', 'replicate', 'functional_score',
    'maximum_functional_score', 'strict_completion', 'fixture_smoke_passed',
    'elapsed_seconds', 'input_tokens', 'cached_input_tokens', 'output_tokens',
    'reasoning_output_tokens', 'tool_call_count', 'command_call_count',
    'prompt_count', 'additional_prompt_count', 'clarification_request_count',
    ...requirementIds.map((id) => `${id.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_score`),
    'regression_failure_count', 'unsupported_assumption_count',
    'leakage_detected', 'secret_leak_detected', 'host_material_detected',
    'unsafe_submission_detected',
  ];
  const values = rows.map((row) => [
    row.trialId, row.evaluationId, row.arm, row.replicate, row.functionalScore,
    row.maximumFunctionalScore, row.strictCompletion, row.fixtureSmokePassed,
    round(row.elapsedSeconds, 3), row.inputTokens, row.cachedInputTokens,
    row.outputTokens, row.reasoningOutputTokens, row.toolCallCount,
    row.commandCallCount, row.promptCount, row.additionalPromptCount,
    row.clarificationRequestCount,
    ...requirementIds.map((id) => row.requirementScores[id]),
    row.regressionFailures.length, row.unsupportedAssumptions.length,
    row.leakageDetected, row.secretLeakDetected, row.hostMaterialDetected,
    row.unsafeSubmissionDetected,
  ]);
  return [headers, ...values].map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

export function renderScoreSvg(summaries, armOrder, armLabels, maximumScore) {
  const width = 1080;
  const height = 500;
  const chartLeft = 105;
  const chartTop = 70;
  const chartWidth = 885;
  const chartHeight = 320;
  const colors = {
    raw_video: '#8A857B',
    transcript_only: '#FF6B4A',
    clipy_arec: '#B7F34A',
    complete_spec: '#7C68EE',
  };
  const slot = chartWidth / armOrder.length;
  const x = (index) => chartLeft + slot * (index + 0.5);
  const y = (score) => chartTop + chartHeight - score / maximumScore * chartHeight;
  const lines = [];
  for (let score = 0; score <= maximumScore; score += 2) {
    const lineY = y(score);
    lines.push(`<line x1="${chartLeft}" y1="${lineY}" x2="${chartLeft + chartWidth}" y2="${lineY}" stroke="#D8D1C3" stroke-width="1"/>`);
    lines.push(`<text x="${chartLeft - 18}" y="${lineY + 5}" text-anchor="end" font-size="14" fill="#666258">${score}</text>`);
  }
  const groups = armOrder.map((arm, index) => {
    const center = x(index);
    const average = summaries[arm].functionalScore.mean;
    const values = summaries[arm].functionalScore.values;
    const dots = values.map((score, dotIndex) => {
      const dotX = center + (dotIndex - (values.length - 1) / 2) * 13;
      return `<circle cx="${dotX}" cy="${y(score)}" r="5" fill="#171713" opacity="0.76"/>`;
    }).join('');
    return [
      `<rect x="${center - 40}" y="${y(average)}" width="80" height="${chartTop + chartHeight - y(average)}" rx="12" fill="${colors[arm]}"/>`,
      dots,
      `<text x="${center}" y="${y(average) - 16}" text-anchor="middle" font-size="23" font-weight="800" fill="#171713">${average.toFixed(1)}</text>`,
      `<text x="${center}" y="${chartTop + chartHeight + 34}" text-anchor="middle" font-size="15" font-weight="700" fill="#171713">${armLabels[arm]}</text>`,
      `<text x="${center}" y="${chartTop + chartHeight + 56}" text-anchor="middle" font-size="12" fill="#666258">n=${values.length}; dots are trials</text>`,
    ].join('');
  }).join('');
  const description = armOrder
    .map((arm) => `${armLabels[arm]} averaged ${summaries[arm].functionalScore.mean.toFixed(1)}`)
    .join(', ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Mean functional score by evidence arm</title>
  <desc id="desc">${description}, out of ${maximumScore}, across five trials per arm.</desc>
  <rect width="${width}" height="${height}" rx="28" fill="#F7F4ED"/>
  <text x="44" y="38" font-family="system-ui, sans-serif" font-size="20" font-weight="800" fill="#171713">Functional score (0–${maximumScore})</text>
  <g font-family="system-ui, sans-serif">${lines.join('')}${groups}</g>
</svg>\n`;
}
