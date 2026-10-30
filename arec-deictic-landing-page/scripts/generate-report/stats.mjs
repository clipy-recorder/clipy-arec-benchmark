export function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function sampleStandardDeviation(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
}

export function wilson(successes, total, z = 1.959963984540054) {
  if (!total) return [null, null];
  const proportion = successes / total;
  const denominator = 1 + z ** 2 / total;
  const center = (proportion + z ** 2 / (2 * total)) / denominator;
  const margin = z * Math.sqrt((proportion * (1 - proportion) + z ** 2 / (4 * total)) / total) / denominator;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function quantile(values, probability) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function bootstrapMeanDifference(first, second, seed, resamples) {
  const random = mulberry32(seed);
  const differences = [];
  for (let iteration = 0; iteration < resamples; iteration += 1) {
    const firstSample = Array.from({ length: first.length }, () => first[Math.floor(random() * first.length)]);
    const secondSample = Array.from({ length: second.length }, () => second[Math.floor(random() * second.length)]);
    differences.push(mean(firstSample) - mean(secondSample));
  }
  return {
    estimate: mean(first) - mean(second),
    percentile95: [quantile(differences, 0.025), quantile(differences, 0.975)],
  };
}

export function round(value, places = 2) {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(places));
}
