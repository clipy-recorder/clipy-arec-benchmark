# AREC deictic landing-page benchmark

This directory contains a synthetic, controlled exploratory benchmark comparing
raw video, transcript-only context, Clipy AREC v0.3-draft context, and a
human-written complete specification on the same landing-page coding task.

The benchmark is intentionally designed around deictic review language such as
“this button” and “move this before that.” It tests whether structured recording
evidence can preserve the referents that a faithful transcript drops. It does
not test every coding task, and it does not assume AREC will win.

## Prerequisites

- macOS with `/usr/bin/say` and `/usr/bin/sandbox-exec`
- Node 20, pnpm, Git, FFmpeg, Python 3, and Codex CLI 0.147.0
- Playwright and its Chromium build, installed locally or globally
- a working local Codex router and authenticated Codex CLI session

Run commands from the repository root. `PLAYWRIGHT_MODULE` may point to a
Playwright module entrypoint when it is not installed in a standard local or
global npm location.

## Reproduce the fixture and conditions

```sh
pnpm install --frozen-lockfile
node benchmarks/arec-deictic-landing-page/scripts/benchmark.mjs prepare
node benchmarks/arec-deictic-landing-page/scripts/benchmark.mjs verify-preregistration
node benchmarks/arec-deictic-landing-page/scripts/benchmark.mjs validate-conditions
node benchmarks/arec-deictic-landing-page/scripts/benchmark.mjs verify-isolation
```

`prepare` records the deterministic local fixture, synthesizes the disclosed
narration, extracts the supported moment assets, renders `recording.arec`
through Clipy's checked-in production renderer, and rebuilds all four condition
packages. The derived scratch files under `source/generated/` are ignored;
condition packages contain the durable evidence used in trials.

## Run and analyze the frozen study

```sh
node benchmarks/arec-deictic-landing-page/scripts/benchmark.mjs run --all
node benchmarks/arec-deictic-landing-page/scripts/benchmark.mjs grade --all
node benchmarks/arec-deictic-landing-page/scripts/redact-retained-results.mjs
node benchmarks/arec-deictic-landing-page/scripts/benchmark.mjs verify-artifact-privacy
node benchmarks/arec-deictic-landing-page/scripts/benchmark.mjs report
```

The runner follows the preregistered 20-trial schedule and skips only already
completed retained primary trials. Each run uses a fresh standalone Git
repository, ephemeral home, default-deny outer sandbox, one prompt, and the
same model/settings. The evaluator stages safe submissions under random opaque
IDs before deterministic browser grading.

The current sandbox uses narrow runtime read exceptions and probes host
application/configuration boundaries. The retained primary runs predate that
hardening; their broader read-only system-runtime allowance and clean artifact
audit are disclosed in `methodology.md` and the generated report.

## Directory guide

- `preregistration.md`, `protocol.json`: frozen design, schedule, settings,
  exclusions, rubric, thresholds, and analysis rule.
- `fixture/base/`: seeded task repository supplied to every trial.
- `source/`: deterministic script, transcript, complete spec, extraction
  stand-ins, and capture provenance.
- `conditions/`: exact evidence packages supplied to the four arms.
- `evaluator/`: hidden-from-trials rubric, gold fixture, and leakage canary.
- `scripts/`: capture, isolation, execution, grading, privacy, and report tools.
- `results/`: retained raw trial/evaluator data and deterministic summaries.

See `methodology.md` for the trust boundaries and `LICENSES.md` for provenance.
