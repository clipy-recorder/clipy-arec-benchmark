# Clipy AREC coding benchmark

Public copy of the AREC deictic landing-page benchmark that Clipy published
on [clipy.online/research/arec-coding-benchmark](https://clipy.online/research/arec-coding-benchmark).

The study gives a coding agent the same landing-page task four ways: the raw
video, a transcript only, a Clipy AREC recording document, and a human-written
complete specification. The review narration is full of deictic language
("this button", "move this before that"), so the benchmark measures whether
structured recording evidence keeps the referents a transcript drops.

Everything is in [`arec-deictic-landing-page/`](arec-deictic-landing-page/):
the protocol, the four input conditions, the fixture, the evaluator and rubric,
per-trial results, and the scripts that produced them. Start with its
[README](arec-deictic-landing-page/README.md) and the
[evaluator correction note](arec-deictic-landing-page/evaluator-correction.md).

The same files are available as a zip from the research page. The scripts
were written to run from the Clipy monorepo, so paths in them start with
`benchmarks/arec-deictic-landing-page/`.

Asset provenance and licensing: see
[`arec-deictic-landing-page/LICENSES.md`](arec-deictic-landing-page/LICENSES.md).
