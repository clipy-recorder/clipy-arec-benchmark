# Evaluator correction record

Status: frozen before the corrected blinded grading pass on 2026-08-17.

The first blinded grading pass exposed a conformance bug in three source-state
recognizers. Chrome observed the required behavior, but the source point was
withheld when a submission used behaviorally equivalent CSS syntax that the
initial regular expressions did not accept:

- `@media (max-width: 639px)` or a selector without an explicit `a` tag for the
  requirement stated as “below 640 CSS pixels”;
- `width: auto` or a responsive single-column `auto-fit` grid for the mobile
  proof-card constraint; and
- separate hover and focus rules, or a valid reordered outline shorthand, for
  the CTA state requirement.

The correction replaces those exact-string recognizers with selector and
declaration checks. It does not change the preregistered task, evidence
packages, rubric, point weights, browser observations, strict-completion rule,
publication thresholds, exclusions, trial outputs, random evaluation IDs, or
analysis method. A box shadow still does not satisfy the rubric's explicit
outline source point, and the mobile source point still requires a layout that
resolves to one column rather than merely avoiding document overflow.

All 20 initial evaluator outputs are retained under
`results/evaluations-initial-source-regex/`. The same opaque submissions will
be regraded once with this frozen correction. The final report must disclose
the correction and publish a machine-readable before/after comparison.
