import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function rgb(value) {
  const parts = value.match(/[\d.]+/g)?.map(Number) ?? [];
  return parts.length >= 3 ? parts.slice(0, 3) : null;
}

function luminance(color) {
  const channels = color.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first, second) {
  const a = rgb(first);
  const b = rgb(second);
  if (!a || !b) return null;
  const bright = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (bright + 0.05) / (dark + 0.05);
}

function round(value, places = 4) {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(places));
}

function boxDistance(actual, expected) {
  const keys = ['x', 'y', 'width', 'height'];
  if (!actual || !expected) return null;
  return keys.reduce((sum, key) => sum + Math.abs(actual[key] - expected[key]), 0) / keys.length;
}

export function scoreSubmission({ source, desktop, mobile, interactions, smoke, baselineHtml, changedFiles }) {
  const hoverContrast = contrast(interactions.hover.color, interactions.hover.backgroundColor);
  const focusTextContrast = contrast(interactions.focus.color, interactions.focus.backgroundColor);
  const outlineWidth = Number.parseFloat(interactions.focus.outlineWidth) || 0;
  const outlineContrast = contrast(interactions.focus.outlineColor, interactions.focus.parentBackgroundColor);
  const boxShadowVisible = interactions.focus.boxShadow !== 'none';
  const focusIndicator = interactions.focus.focusVisible && (
    (interactions.focus.outlineStyle !== 'none' && outlineWidth >= 2 && (outlineContrast ?? 0) >= 3) ||
    boxShadowVisible
  );
  const startOutlined = desktop.start?.backgroundColor === 'rgba(0, 0, 0, 0)' &&
    desktop.start?.borderStyle === 'solid' && Number.parseFloat(desktop.start.borderWidth) >= 2;
  const seeHowFilled = desktop.seeHow?.backgroundColor !== 'rgba(0, 0, 0, 0)';
  const visibleMobileNavigation = ['Product', 'Customers', 'Pricing'].every((label) =>
    mobile.links.some((link) => link.text === label && link.display !== 'none'));
  const behavior = {
    headline: desktop.h1 === 'Move work forward without another meeting.' && desktop.h1Count === 1,
    ctaHierarchy: desktop.primaryCount === 1 && startOutlined && seeHowFilled,
    responsiveNavigation:
      desktop.resources?.display !== 'none' && mobile.resources?.display === 'none' && visibleMobileNavigation,
    assuranceOrder:
      desktop.assuranceCount === 3 &&
      desktop.assuranceOrder.join('|') === 'Cancel anytime|No credit card|Works with your stack',
    mobileOverflow: mobile.documentScrollWidth <= mobile.documentClientWidth && mobile.proofCount === 3,
    ctaStates: (hoverContrast ?? 0) >= 4.5 && (focusTextContrast ?? 0) >= 4.5 && focusIndicator,
  };
  const requirements = Object.keys(source).map((id) => ({
    id,
    sourcePoint: source[id] ? 1 : 0,
    behaviorPoint: behavior[id] ? 1 : 0,
    score: Number(source[id]) + Number(behavior[id]),
  }));
  const functionalScore = requirements.reduce((sum, item) => sum + item.score, 0);

  const allowedFiles = new Set(['app.js', 'index.html', 'styles.css']);
  const unexpectedFiles = changedFiles.filter((file) => !allowedFiles.has(file));
  const baselineAnchorCount = (baselineHtml.match(/<a\b/g) ?? []).length;
  const unsupportedAssumptions = [
    ...(desktop.sectionCount !== 4 ? ['changed-section-count'] : []),
    ...(desktop.links.length !== baselineAnchorCount ? ['changed-link-count'] : []),
    ...(desktop.proofCount !== 3 ? ['changed-proof-card-count'] : []),
    ...(desktop.assuranceCount !== 3 ? ['changed-assurance-count'] : []),
    ...unexpectedFiles.map((file) => `unexpected-file:${file}`),
  ];
  const regressionFailures = [
    ...(!smoke.passed ? ['fixture-smoke-test'] : []),
    ...(desktop.sectionCount !== 4 ? ['section-count'] : []),
    ...(desktop.proofCount !== 3 ? ['proof-card-count'] : []),
    ...(desktop.assuranceCount !== 3 ? ['assurance-count'] : []),
    ...(desktop.links.length !== baselineAnchorCount ? ['link-count'] : []),
    ...unexpectedFiles.map((file) => `unexpected-file:${file}`),
  ];
  const accessibility = {
    unnamedLinks: desktop.unnamedLinks,
    duplicateIds: desktop.duplicateIds,
    h1Count: desktop.h1Count,
    focusOrder: interactions.focusOrder,
    bothRequestedCtasKeyboardReachable:
      interactions.focusOrder.some((item) => item.id === 'start-free') &&
      interactions.focusOrder.some((item) => item.id === 'see-how'),
    hoverTextContrast: round(hoverContrast),
    focusTextContrast: round(focusTextContrast),
    focusIndicatorContrast: round(outlineContrast),
    focusIndicatorVisible: focusIndicator,
  };
  return { requirements, functionalScore, regressionFailures, unsupportedAssumptions, accessibility };
}

export async function measureVisuals({ screenshots, desktop, mobile, goldDesktop, goldMobile, pixelDiffScript }) {
  const pixelDiff = {};
  for (const viewport of ['desktop', 'mobile']) {
    const actual = viewport === 'desktop' ? screenshots.actualDesktop : screenshots.actualMobile;
    const reference = viewport === 'desktop' ? screenshots.goldDesktop : screenshots.goldMobile;
    const result = await execFileAsync('python3', [pixelDiffScript, actual, reference]);
    pixelDiff[viewport] = JSON.parse(result.stdout);
  }
  await Promise.all([
    rm(screenshots.goldDesktop, { force: true }),
    rm(screenshots.goldMobile, { force: true }),
  ]);

  const bboxSelectors = ['start', 'seeHow', 'proofFirst'];
  const meanDistance = (actual, reference) => round(bboxSelectors
    .map((selector) => boxDistance(actual[selector], reference[selector]))
    .filter((value) => value != null)
    .reduce((sum, value, _, values) => sum + value / values.length, 0));
  return {
    pixelDiff,
    bboxDistance: {
      desktopMeanCssPx: meanDistance(desktop, goldDesktop),
      mobileMeanCssPx: meanDistance(mobile, goldMobile),
    },
  };
}
