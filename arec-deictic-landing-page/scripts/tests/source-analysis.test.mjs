import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { sourceChecks } from '../grade-submission/source-analysis.mjs';

test('source checks recognize every frozen requirement in the gold fixture', async () => {
  // Given: the independently retained reference fixture.
  const [html, css] = await Promise.all([
    readFile(new URL('../../evaluator/gold/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../evaluator/gold/styles.css', import.meta.url), 'utf8'),
  ]);

  // When: the trusted source rubric evaluates it.
  const actual = sourceChecks(html, css);

  // Then: every preregistered source-state requirement is present.
  assert.deepEqual(actual, {
    headline: true,
    ctaHierarchy: true,
    responsiveNavigation: true,
    assuranceOrder: true,
    mobileOverflow: true,
    ctaStates: true,
  });
});

test('source checks reject every frozen requirement in the seeded fixture', async () => {
  // Given: the unchanged landing page before the requested review changes.
  const [html, css] = await Promise.all([
    readFile(new URL('../../fixture/base/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../fixture/base/styles.css', import.meta.url), 'utf8'),
  ]);

  // When: the trusted source rubric evaluates it.
  const actual = sourceChecks(html, css);

  // Then: the base does not accidentally contain an accepted solution.
  assert.deepEqual(actual, {
    headline: false,
    ctaHierarchy: false,
    responsiveNavigation: false,
    assuranceOrder: false,
    mobileOverflow: false,
    ctaStates: false,
  });
});

test('source checks accept behavior-equivalent CSS syntax', async () => {
  const html = await readFile(new URL('../../evaluator/gold/index.html', import.meta.url), 'utf8');
  const goldCss = await readFile(new URL('../../evaluator/gold/styles.css', import.meta.url), 'utf8');
  const css = goldCss
    .replace(
      /#see-how:hover, #see-how:focus-visible \{[^}]+\}/,
      '#see-how:hover { color: white; }\n#see-how:focus-visible { color: #fff; outline: solid 3px var(--ink); }',
    )
    .replace(
      '.proof-grid { grid-template-columns: 1fr; max-width: 100%; width: 100%; }',
      '.proof-grid { grid-template-columns: 1fr; width: auto; }',
    )
    .replace('@media (max-width: 640px) {\n  nav a[data-nav="resources"]', '@media (max-width: 639px) {\n  nav [data-nav="resources"]');

  assert.notEqual(css, goldCss);
  assert.match(css, /@media \(max-width: 639px\)/);
  assert.match(css, /outline: solid 3px/);
  assert.match(css, /\.proof-grid \{ grid-template-columns: 1fr; width: auto; \}/);

  assert.deepEqual(sourceChecks(html, css), {
    headline: true,
    ctaHierarchy: true,
    responsiveNavigation: true,
    assuranceOrder: true,
    mobileOverflow: true,
    ctaStates: true,
  });
});

test('source checks do not treat a shadow as the required outline', async () => {
  const [html, goldCss] = await Promise.all([
    readFile(new URL('../../evaluator/gold/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../evaluator/gold/styles.css', import.meta.url), 'utf8'),
  ]);
  const css = goldCss.replace(
    /#see-how:hover, #see-how:focus-visible \{[^}]+\}/,
    '#see-how:hover, #see-how:focus-visible { color: white; }\n#see-how:focus-visible { outline: none; box-shadow: 0 0 0 3px black; }',
  );

  assert.equal(sourceChecks(html, css).ctaStates, false);
});
