---
title: M2 import pipeline
label: wayfinder:task
status: open
assignee: Ignas + Claude (this session)
blocked-by: []
---

## Question

Build milestone M2 from the [Build plan](014-build-plan.md): the worker
pipeline end-to-end (search → skip cached → extract in ~200-email batches →
deduplicate/merge → reconstruct trips → build history), the live progress
page (frame 1c) on Realtime, the reviewable failure list, and the completion
email. Opens with the kitinerary spike (CI job on the worker's Debian base)
whose verdict decides whether tier 2 ships in the Docker image.

Success criterion (brief §34 M2/M3 merged into our plan): the user's real
mailbox imports — flights extracted, deduplicated, and visible as counts.

## Kitinerary spike verdict

Ran as a CI job (throwaway workflow, now deleted; runs 33205293316,
33205662341, and the Alpine probe): `kitinerary-extractor` is not packaged in
Debian bookworm or trixie at all, and Alpine's `kitinerary` package is the
library without the CLI at a ~640 MB Qt dependency cost. Building KDE from
source in the worker image is exactly the "too heavy" case the extraction
ticket pre-approved falling back from.

**Verdict: tier 2 drops out of the MVP image.** The pipeline ships schema.org
(tier 1) + capped Haiku (tier 3); `KITINERARY_BIN` remains an optional env
hook in the pipeline, and deterministic per-carrier parsers get added
incrementally where eval data shows Haiku doing repeat work.
