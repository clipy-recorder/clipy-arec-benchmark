import assert from 'node:assert/strict';
import { test } from 'node:test';

import { scoreSubmission } from '../grade-submission/scoring.mjs';

const allSourceRequirements = {
  headline: true,
  ctaHierarchy: true,
  responsiveNavigation: true,
  assuranceOrder: true,
  mobileOverflow: true,
  ctaStates: true,
};

test('scoring awards twelve points to an observed complete implementation', () => {
  // Given: source and browser observations matching the frozen gold behavior.
  const scoredInput = {
    source: allSourceRequirements,
    desktop: {
      h1: 'Move work forward without another meeting.',
      h1Count: 1,
      sectionCount: 4,
      primaryCount: 1,
      start: {
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderStyle: 'solid',
        borderWidth: '2px',
      },
      seeHow: { backgroundColor: 'rgb(91, 75, 231)' },
      resources: { display: 'block' },
      assuranceOrder: ['Cancel anytime', 'No credit card', 'Works with your stack'],
      assuranceCount: 3,
      proofCount: 3,
      links: Array.from({ length: 8 }),
      unnamedLinks: 0,
      duplicateIds: [],
    },
    mobile: {
      documentClientWidth: 390,
      documentScrollWidth: 390,
      resources: { display: 'none' },
      proofCount: 3,
      links: [
        { text: 'Product', display: 'inline' },
        { text: 'Customers', display: 'inline' },
        { text: 'Resources', display: 'none' },
        { text: 'Pricing', display: 'inline' },
      ],
    },
    interactions: {
      hover: { backgroundColor: 'rgb(64, 52, 181)', color: 'rgb(255, 255, 255)' },
      focus: {
        backgroundColor: 'rgb(64, 52, 181)',
        color: 'rgb(255, 255, 255)',
        outlineColor: 'rgb(17, 17, 17)',
        outlineStyle: 'solid',
        outlineWidth: '3px',
        boxShadow: 'none',
        parentBackgroundColor: 'rgb(247, 245, 239)',
        focusVisible: true,
      },
      focusOrder: [
        { id: 'start-free', text: 'Start free' },
        { id: 'see-how', text: 'See how it works' },
      ],
    },
    smoke: { passed: true },
    baselineHtml: '<a></a>'.repeat(8),
    changedFiles: ['index.html', 'styles.css'],
  };

  // When: the deterministic grader scores the implementation.
  const result = scoreSubmission(scoredInput);

  // Then: all six two-point requirements pass without a regression.
  assert.equal(result.functionalScore, 12);
  assert.deepEqual(result.requirements.map((item) => item.score), [2, 2, 2, 2, 2, 2]);
  assert.deepEqual(result.regressionFailures, []);
  assert.deepEqual(result.unsupportedAssumptions, []);
});
