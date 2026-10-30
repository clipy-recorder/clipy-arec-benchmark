# Methodology and trust boundaries

## Scope

This is a product-authored synthetic case study, not independent or
peer-reviewed research. The fictional Relay page, narration, review note,
cursor events, extracted fields, reference implementation, and rubric were
constructed for this benchmark. No customer recording, production secret,
personal data, or proprietary third-party content is used.

The narrow research question is whether AREC helps on a task where natural
speech depends on visual referents. A second fully spoken requirement is
included as an internal check that transcript-only context remains useful when
the words are sufficient.

## Evidence derivation

One deterministic 44-second H.264/AAC recording is the common source. The raw
arm receives that MP4. The transcript arm receives only the verbatim narration.
The AREC arm receives the verbatim transcript plus the fields and precomputed
assets supported by Clipy's current production `buildAgentContextMarkdown`
renderer. The complete-spec arm receives a human-written list of the same six
frozen outcomes and is reported as a positive control.

The AREC summary and action items are fixture-authored stand-ins for a
successful extraction pass. Their provenance is disclosed in the condition,
source data, preregistration, report, and public page. Consequently, the study
measures the utility of a fully populated AREC handoff, not the accuracy of the
hosted upload, transcription, moment-selection, or summarization pipeline.

## Isolation and leakage prevention

Each trial starts from the same copied fixture in a new standalone Git
repository. Only that arm's `evidence/` directory is copied. The runner creates
a fresh `HOME`, `CODEX_HOME`, and temporary directory, copies only the minimum
authentication/model transport files needed to start the fixed CLI, and removes
authentication after the model thread begins.

The outer macOS Seatbelt profile is default-deny. It permits writes only inside
the ephemeral trial/home paths, permits outbound traffic only to the loopback
model router, and denies process inspection, Keychain, clipboard, app launching,
and external network. The checked-in runner now limits runtime reads to named
system binary/library trees and Homebrew package trees while explicitly probing
that application data, preferences, `/usr/local/etc`, and `/opt/homebrew/etc`
remain unreadable.

A post-run security review found that the profile used for the 20 retained
primary trials had broader read-only runtime exceptions for `/usr`, `/Library`,
and `/opt/homebrew` than were necessary. The event logs contain no command that
read those host configuration/application-data locations, and the retained and
public artifacts passed the host-material and secret scans. The home directory,
benchmark siblings, evaluator, other arms, writes, and external network remained
blocked. The runner was hardened and its boundary probes expanded after the
primary results; the primary trials were not rerun. This is an execution-
environment limitation, not evidence that host data affected the measured scores.
A separate post-result transcript-only diagnostic pilot completed a model turn under
the hardened profile with no leakage, secret, host-material, unsafe-submission, or
timeout detection. It is retained under `results/pilots/` and excluded from every
reported primary result.

The benchmark root, evaluator, other arms, prior results, source checkout, and
sibling worktrees are not readable from the trial sandbox. Before retention,
the runner scans file names and contents outside `evidence/` for the hidden
canary, copied credential values, common secret patterns, non-regular entries,
and host material. Unsafe submissions are withheld under the frozen exclusion
rule. Text artifacts are sanitized and audited again before publication.

## Evaluation

Safe submissions are copied without their evidence packages to random
`eval-<hex>` paths. The grader sees only the anonymous submitted fixture and a
trusted gold fixture. It does not receive the arm, trial name, transcript,
AREC, raw video, report, or blinding map. Submission-authored tests and scripts
are not executed.

The deterministic grader serves canonicalized in-root static files with a
restrictive content policy and blocks non-study browser requests. Each of six
requirements earns one source-state point and one observed Chrome-behavior
point. The untouched fixture must score 0/12 and the frozen gold fixture must
score 12/12. Screenshots, structural observations, accessibility measurements,
changed files, regression flags, and unsupported assumptions are retained.

## Interpretation

All scheduled primary runs are reported. Five runs per arm describe variance
but do not support broad statistical-significance or universal-superiority
claims. Raw video is capability-constrained if the fixed CLI cannot ingest
video pixels/audio directly; that constraint stays adjacent to every raw-video
comparison. The complete-spec arm is calibration, not another recording format.

The preregistered public-claim threshold is deliberately demanding. If it is
not met, the public material must say the benchmark did not establish the
intended advantage. No post-result rubric change or selective rerun can turn a
miss into a win.
