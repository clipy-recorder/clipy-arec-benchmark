import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { walkFiles } from '../walk-files.mjs';

export function fixtureSmoke(html, css, client) {
  const checks = [
    /<h1 id="hero-title">[^<]+<\/h1>/.test(html),
    /id="start-free"/.test(html),
    /id="see-how"/.test(html),
    (html.match(/data-assurance=/g) ?? []).length === 3,
    /data-nav="resources"/.test(html),
    /class="proof-grid"/.test(html),
    /@media \(max-width: 700px\)/.test(css),
    /setCapturePointerMode/.test(client),
  ];
  const passed = checks.every(Boolean);
  return {
    passed,
    exitCode: passed ? 0 : 1,
    stdout: passed ? 'Trusted fixture invariants passed.\n' : '',
    stderr: passed ? '' : 'One or more trusted fixture invariants failed.\n',
  };
}

function cssRules(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1]
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean),
    declarations: match[2],
  }));
}

function declarationMap(declarations) {
  const properties = new Map();
  for (const match of declarations.matchAll(/([\w-]+)\s*:\s*([^;}]+)/g)) {
    properties.set(match[1].toLowerCase(), match[2].trim());
  }
  return properties;
}

function declarationsFor(css, selector) {
  return cssRules(css)
    .filter((rule) => rule.selectors.includes(selector))
    .map((rule) => rule.declarations)
    .join(';');
}

function maxWidthSections(css) {
  const starts = [...css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/gi)];
  return starts.map((match, index) => ({
    maxWidth: Number(match[1]),
    css: css.slice(match.index, starts[index + 1]?.index ?? css.length),
  }));
}

function hidesResourcesAtPhoneWidth(css) {
  return maxWidthSections(css)
    .filter(({ maxWidth }) => maxWidth >= 639 && maxWidth <= 640)
    .some(({ css: section }) =>
      cssRules(section).some(({ selectors, declarations }) => {
        const targetsResources = selectors.some((selector) =>
          /\[data-nav\s*=\s*["']?resources["']?\]/i.test(selector),
        );
        return targetsResources && declarationMap(declarations).get('display') === 'none';
      }),
    );
}

function constrainsProofGrid(css) {
  return maxWidthSections(css)
    .filter(({ maxWidth }) => maxWidth >= 390 && maxWidth <= 700)
    .some(({ css: section }) => {
      const declarations = declarationsFor(section, '.proof-grid');
      const properties = declarationMap(declarations);
      const columns = properties.get('grid-template-columns') ?? '';
      const width = properties.get('width');
      const maxWidth = properties.get('max-width');
      const singleColumn =
        /^1fr$/i.test(columns) ||
        /^repeat\(\s*1\s*,/i.test(columns) ||
        /^repeat\(\s*auto-(?:fit|fill)\s*,\s*minmax\(\s*min\(\s*100%/i.test(columns);
      const containerWidth = width === 'auto' || width === '100%' || maxWidth === '100%';
      return singleColumn && containerWidth;
    });
}

function isWhite(value) {
  return /^(?:white|#fff(?:fff)?)$/i.test(value ?? '');
}

function hasRequiredOutline(properties) {
  const shorthand = properties.get('outline');
  if (shorthand) {
    const width = Number(shorthand.match(/(?:^|\s)(\d+(?:\.\d+)?)px(?:\s|$)/)?.[1]);
    return width >= 2 && !/(?:^|\s)(?:none|transparent)(?:\s|$)/i.test(shorthand);
  }
  const width = Number.parseFloat(properties.get('outline-width') ?? '');
  const style = properties.get('outline-style') ?? '';
  const color = properties.get('outline-color') ?? '';
  return width >= 2 && !/^(?:none|hidden)$/i.test(style) && !/^transparent$/i.test(color);
}

function declaresRequiredCtaStates(css) {
  const hover = declarationMap(declarationsFor(css, '#see-how:hover'));
  const focus = declarationMap(declarationsFor(css, '#see-how:focus-visible'));
  return isWhite(hover.get('color')) && isWhite(focus.get('color')) && hasRequiredOutline(focus);
}

export function sourceChecks(html, css) {
  const startTag = html.match(/<a[^>]*id="start-free"[^>]*class="([^"]*)"[^>]*>/i);
  const seeHowTag = html.match(/<a[^>]*id="see-how"[^>]*class="([^"]*)"[^>]*>/i);
  const assuranceCancel = html.indexOf('data-assurance="cancel"');
  const assuranceNoCard = html.indexOf('data-assurance="no-card"');
  const assuranceStack = html.indexOf('data-assurance="stack"');
  return {
    headline: /<h1[^>]*id="hero-title"[^>]*>Move work forward without another meeting\.<\/h1>/i.test(html),
    ctaHierarchy:
      Boolean(seeHowTag?.[1].split(/\s+/).includes('button-primary')) &&
      Boolean(startTag?.[1].split(/\s+/).includes('button-secondary')) &&
      !startTag?.[1].split(/\s+/).includes('button-primary'),
    responsiveNavigation: hidesResourcesAtPhoneWidth(css),
    assuranceOrder:
      assuranceCancel >= 0 && assuranceNoCard > assuranceCancel && assuranceStack > assuranceNoCard,
    mobileOverflow: constrainsProofGrid(css),
    ctaStates: declaresRequiredCtaStates(css),
  };
}

export async function changedFilesAgainstBase(submissionRoot, baseRoot) {
  const [submissionPaths, basePaths] = await Promise.all([walkFiles(submissionRoot), walkFiles(baseRoot)]);
  const relative = (root, path) => path.slice(root.length + 1);
  const relevant = (path) => !path.startsWith('.git/') && path !== '.git';
  const all = new Set([
    ...submissionPaths.map((path) => relative(submissionRoot, path)).filter(relevant),
    ...basePaths.map((path) => relative(baseRoot, path)).filter(relevant),
  ]);
  const changed = [];
  for (const path of [...all].sort()) {
    const [submission, base] = await Promise.all([
      readFile(join(submissionRoot, path)).catch(() => null),
      readFile(join(baseRoot, path)).catch(() => null),
    ]);
    if (!submission || !base || !submission.equals(base)) changed.push(path);
  }
  return changed;
}
