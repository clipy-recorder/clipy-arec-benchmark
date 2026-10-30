# Synthetic source evidence

These files define the single controlled recording from which every condition
is derived:

- `timeline.json`: frozen narration and capture actions.
- `transcript.txt`: faithful speech-only transcript.
- `capture.json`: fictional app/window identity.
- `extracted-context.json`: disclosed fixture-authored stand-in for successful
  summary and action-item extraction.
- `complete-spec.txt`: positive-control requirements.

`scripts/benchmark.mjs prepare` creates the ignored `generated/` scratch tree,
then packages durable evidence under `../conditions/`. Nothing in this source
directory comes from a customer or production recording.
