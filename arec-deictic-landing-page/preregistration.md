# Preregistration: grounded recording evidence for a deictic coding task

Frozen before fixture agents, pilot model turns, primary trial execution, or
grading on 2026-08-17. This is a synthetic, controlled, exploratory benchmark
designed after reviewing the failed 2026-08-14 pilot. It is not independent or
peer-reviewed research.

## Why this replacement study exists

The earlier Northstar pilot did not isolate the value of structured visual
recording evidence. Its transcript exposed enough of the task for agents to
infer most changes from the repository, AREC agents did not inspect the linked
images as pixels, and one hidden answer was absent from every condition. AREC
scored below transcript-only on that frozen rubric. Those results will not be
rewritten, reused as primary data, or pooled into this study.

This replacement asks a narrower, product-relevant question: when a design
review uses natural deictic language such as “this button,” “this link,” and
“move this before that,” can a fully populated AREC document ground those
references well enough for a coding agent to implement the demonstrated
changes more accurately than a faithful transcript alone?

The benchmark is deliberately constructed to stress a strength AREC claims to
provide. It is not intended to represent transcript-sufficient tasks, and any
public conclusion must retain that boundary.

## Research question and hypotheses

Research question: for one synthetic landing-page review containing five
visually grounded or cursor-grounded requests and one fully spoken request, how
do raw video, transcript-only context, Clipy AREC v0.3-draft context, and a
human-written complete specification affect implementation accuracy?

Primary directional hypothesis H1: `clipy_arec` will exceed
`transcript_only` by at least 4 points on the 12-point functional score because
the transcript faithfully preserves the words but loses the referents for five
requests.

Secondary hypothesis H2: `clipy_arec` will achieve strict completion in at
least 4 of 5 trials while `transcript_only` will achieve strict completion in
at most 1 of 5 trials.

Calibration hypothesis H3: `clipy_arec` will finish within 1 mean point of the
`complete_spec` positive control. A larger gap indicates that the AREC package
is still too ambiguous or distracting even when it contains the necessary
evidence.

Capability hypothesis H4: `clipy_arec` will exceed `raw_video` under this
specific installed CLI because the CLI has no direct video-attachment flag.
Raw-video decoding and inspection remain capability measurements, not a
general comparison with models or tools that natively ingest video.

Null, mixed, and adverse outcomes are allowed. No result is guaranteed. The
study will not be stopped, replaced, or selectively reported because AREC
fails to meet a hypothesis.

## Synthetic task

The fixture is a deterministic one-page HTML/CSS/JavaScript landing page for a
fictional collaboration product named Relay. The same minimal task instruction
is supplied to every arm:

> Implement the landing-page changes requested in the supplied evidence.
> Work only in this repository. Inspect the evidence package first, make the
> smallest correct patch, run the available checks, and finish with a concise
> summary of what you changed and verified. Do not ask for another prompt; if
> evidence is incomplete, make the most defensible implementation and state
> the uncertainty.

The recording demonstrates six objectively gradable requirements:

1. **Visual-note headline.** Replace the hero H1 with the exact text shown in a
   temporary review note: “Move work forward without another meeting.” The
   narration says only “use the exact headline from this note.” The note is
   injected only into the recording surface and is not present in the trial
   repository.
2. **Cursor-grounded CTA hierarchy.** Make “See how it works” the sole filled
   primary hero action and render “Start free” as the outlined secondary
   action. The narration says “make this one the only filled button” while a
   Flare identifies the intentionally counter-conventional target.
3. **Cursor-grounded responsive navigation.** Hide only the “Resources” link
   below 640 CSS pixels while preserving the other navigation links. The
   narration says “hide this navigation item on phones” while a Flare identifies
   the link.
4. **Motion-grounded assurance order.** Move “Cancel anytime” immediately
   before “No credit card.” The narration says “move this before that” while a
   recorded motion gesture identifies source and destination.
5. **Fully spoken mobile repair.** At 390 CSS pixels, keep every proof card but
   remove page-wide horizontal overflow. This request is fully understandable
   from speech and serves as an internal negative control: transcript-only
   should not need visual grounding to receive full credit.
6. **Cursor/state-grounded interaction.** On “See how it works,” preserve white
   label text on hover and keyboard focus and show a visible focus ring with at
   least 3:1 contrast against adjacent colors. The narration refers to “this
   same filled action,” while the key moment records the target and hover state.

The source values above are the complete hidden rubric. No additional copy,
color, layout, price, destination, or product requirement may be inferred by
the evaluator.

## Conditions

Every condition is derived from the same deterministic recording and receives
the identical common task instruction. Trial repositories contain only the
base fixture and the assigned evidence package.

### A. `raw_video`

The source H.264/AAC MP4 plus its checksum and a content-type note. No
transcript, extracted frame, summary, key moment, cursor coordinate, or added
interpretation is included. Agents may use any local executable available to
all arms. Frame/audio extraction and successful visual inspection are recorded
separately from task quality.

### B. `transcript_only`

A faithful timestamped transcript of the recording narration. It contains the
natural deictic phrases verbatim and no frames, cursor/motion coordinates, key
moments, summary, action items, diagnostics, or visual description.

### C. `clipy_arec`

The document emitted by the repository's current production
`buildAgentContextMarkdown` renderer using the real `clipy-recording` profile
and AREC `0.3-draft` identity. It contains:

- the same faithful transcript;
- fixture-authored synthetic summary and action-item fields, explicitly
  disclosed as controlled stand-ins for a successful extraction pass;
- supported key-moment fields with precomputed frame/crop references;
- recorded `flare`, `hover`, and motion source/destination coordinates;
- capture identity and explicit capture gaps;
- no browser diagnostics, because none are needed for this task.

The fixture-authored extracted fields are limited to facts visible in the
recording and are frozen before trials. This condition tests the utility of a
fully populated AREC document, not the accuracy of Clipy's hosted transcription,
summarization, or moment-selection workers.

### D. `complete_spec`

A concise human-written specification listing the six requirements above with
no video, transcript, frames, cursor evidence, AREC wrapper, extra rationale,
or implementation hints. It is a positive control and remains analytically
separate from the three recording-derived arms.

## Fairness and leakage controls

- Same base commit, model, reasoning effort, prompt, token/time budget,
  executables, system instructions, filesystem policy, and validation access.
- Fresh standalone Git repository, randomized trial path, ephemeral home, and
  ephemeral `CODEX_HOME` for every run.
- Default-deny macOS Seatbelt profile. Writes are limited to the fresh trial
  repository, ephemeral home, and temp directory. External network is denied;
  only the configured loopback model transport is allowed.
- Minimal environment allowlist. Ambient user configuration, histories,
  memories, plugins, and unrelated skills are not copied.
- The benchmark repository, evaluator, gold patch, other arms, prior trials,
  original checkout, and other worktrees are denied by the outer sandbox.
- Submitted tests are never executed by the grader. The grader serves static
  files from a realpath-contained root with scripts and non-study network
  blocked.
- Filenames, file contents, logs, patches, answers, metadata commands, and
  retained submissions are scanned for canaries, host identity/path material,
  and common credential patterns before persistence.
- A detected leak or non-regular submission entry withholds the submission and
  excludes the run only under the frozen exclusion rule below.

## Trial system and fixed settings

- Runtime: Codex CLI 0.147.0, non-interactive `codex exec`.
- Model: `gpt-5.6-terra`.
- Reasoning effort: `medium`.
- Service tier: default for that model/account.
- Prompt count: exactly one; no follow-up or clarification is supplied.
- Timeout: 12 minutes wall clock per trial.
- Model output budget: runtime default; input, cached input, output, and
  reasoning tokens are retained when exposed by JSONL.
- Temperature/seed: not exposed by this CLI/model. Replicates are fresh
  sessions but are not statistically independent in a strict experimental
  sense.
- Validation: the fixture's smoke command, browser availability, and installed
  local executables are identical. The smoke test asserts only baseline
  structural validity and does not encode any requested change.

## Sample, order, and stopping rule

Primary sample: 20 completed trials, five per arm. The positive control is
included in execution order but excluded from the two primary AREC-versus-
recording-context comparisons.

The frozen block order is:

1. raw_video, transcript_only, clipy_arec, complete_spec
2. transcript_only, clipy_arec, complete_spec, raw_video
3. clipy_arec, complete_spec, raw_video, transcript_only
4. complete_spec, raw_video, transcript_only, clipy_arec
5. transcript_only, complete_spec, clipy_arec, raw_video

Trials run sequentially to avoid resource contention. Harness-only pilots are
retained and never included in primary results.

Stopping rule: attempt all 20 scheduled primary trials. Do not stop early for a
favorable or unfavorable pattern. At most one infrastructure rerun is allowed
when the original produced no model turn because the CLI, local transport,
host, or sandbox failed. Both attempts remain retained. Refusal, inability to
inspect video, timeout after a model turn, invalid code, empty patch, and low
scores are outcomes and are not rerun.

If cost, rate limiting, or host availability prevents all 20 completions, stop
only after preserving every attempted run. Report achieved n by arm, label the
study underpowered, and do not impute missing results.

## Frozen evaluation rubric

Primary functional score: 0-12, two points per requirement.

For each requirement:

- 1 source-state point for the exact required HTML/CSS state; and
- 1 observed-behavior point in Chrome at the specified viewport/state.

The six item checks are:

1. H1 text exactly equals “Move work forward without another meeting.” and the
   rendered accessible H1 matches.
2. “See how it works” is the only filled primary hero CTA; “Start free” remains
   present and is visually outlined/secondary.
3. “Resources” is visible at 1440 pixels and hidden at 390 pixels while the
   other frozen navigation labels remain visible.
4. In source and rendered DOM order, “Cancel anytime” immediately precedes “No
   credit card,” with all assurance items preserved.
5. At 390×844, document scroll width does not exceed viewport width and all
   proof cards remain present and readable.
6. “See how it works” keeps white text on hover and keyboard focus, exposes a
   visible focus indicator, and the indicator has at least 3:1 contrast against
   adjacent colors.

Strict completion requires 12/12, all baseline fixture invariants, no serious
accessibility regression, no unexpected external request, no hidden content
removal, and no unrelated user-facing requirement.

Secondary outcomes:

- per-requirement source and behavior pass rates;
- strict completion fraction and Wilson 95% interval;
- desktop and mobile screenshots plus structural bounding-box distance to the
  gold fixture;
- accessibility names, keyboard reachability, focus visibility, and relevant
  contrast;
- page-wide mobile overflow;
- expected/unexpected changed files and regression count;
- elapsed wall time, token usage, tool-call count, and supplied prompt count;
- unsupported-assumption count;
- raw-video extraction, transcription, and visual-inspection capability;
- AREC image-reference access, action-item use, and key-moment use when visible
  in event logs.

Unsupported assumptions are material user-facing changes outside the six
requirements: new sections, claims, CTA destinations, deleted content, changed
labels other than the H1, or broad navigation/card removal. Reasonable
implementation details do not count.

## Blinding

Each retained safe submission is copied under a cryptographically random opaque
`eval-<hex>` ID and neutral staging path before grading. The grader receives no
arm label, trial name, evidence package, transcript, AREC document, report, or
blinding map. Arm labels are joined only after all deterministic grader records
exist.

The primary score is fully automated. Any human visual-polish judgment is
predefined, blinded when practical, reported separately, and never changes the
12-point score.

## Exclusions and missing data

Exclude from primary comparisons only:

- harness pilots;
- no model turn due to documented host, sandbox, or transport failure;
- base fixture or condition checksum mismatch;
- detected access to a denied evaluator, other arm, or prior-trial canary;
- submission withheld because a non-regular file or detected secret makes safe
  grading impossible.

Do not exclude refusal, inability to decode video, timeout after a model turn,
invalid code, empty patch, low score, unsupported assumption, or failure to use
AREC evidence. Those are outcomes. Missing usage fields remain null. A timeout
is graded from the patch present at cutoff when it can be retained safely.

## Analysis and publication rule

Report every primary trial and arm-level n, mean, median, sample standard
deviation, min/max, strict completion, per-requirement pass rates, and process
metrics. Report seeded 10,000-resample percentile bootstrap intervals for mean
differences and Wilson 95% intervals for completion. Do not use statistical-
significance language with five trials per arm.

Primary comparisons:

- AREC minus transcript-only on score, strict completion, elapsed time, and
  output tokens;
- AREC minus raw video on the same metrics, with the raw capability constraint
  adjacent;
- AREC minus complete specification as calibration, clearly separate from the
  recording-context comparison.

A public page may say AREC produced a “substantial advantage in this controlled
deictic task” only if all are true:

1. AREC mean score exceeds transcript-only by at least 4/12;
2. AREC strict completion is at least 4/5 and transcript-only strict completion
   is at most 1/5;
3. AREC finishes within 1 mean point of complete_spec;
4. no primary AREC or transcript trial is excluded for leakage or unsafe
   retention; and
5. the claim is immediately bounded to this synthetic task and does not say
   AREC is universally superior.

If any condition fails, the public page must say the benchmark did not
establish the intended advantage. No metric, rubric, sample, exclusion,
hypothesis, or threshold will change after this file is checksummed.

