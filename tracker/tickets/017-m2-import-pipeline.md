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

## First live run (2026-08-29)

Reached the extract stage against the real mailbox: **740 candidates found**,
batches of 200, deterministic tier running. Two faults surfaced and are fixed:

1. **Stale worker with stale credentials.** A `pkill` pattern that didn't
   match left an old worker alive holding the pre-fix client secret; it won
   the job claim and failed it. Killing by PID is now the routine — nothing
   to fix in the product, but worth remembering when running two workers
   locally.
2. **LLM tier entirely unavailable** (Anthropic account had no credit) turned
   into 65 identical per-item `processing_error` rows. Fixed properly: typed
   `LlmUnavailableError`, a per-job breaker, `extraction_degraded` on the
   job, systemically-skipped emails deliberately left uncached so a re-run
   retries exactly them, and a progress-page notice with "Run the rest".

State after the run: 11 emails cached (read, not flights), 65 uncached
failures awaiting retry, 0 flights. Nothing is lost or wrongly cached.

**Cost estimate correction.** The pipeline ticket priced the 300-call cap at
"~$1". Measured properly: bodies are capped at 30k chars (~7.5k tokens), so
300 Haiku calls is nearer **$2–3** per full first import. The cap still
bounds the spend; the number in the map's decision line was optimistic.

Remaining to close: credits on the Anthropic account, then a clean run to the
completion email — the milestone's success criterion.
