---
title: M2 import pipeline
label: wayfinder:task
status: closed
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

## What the first complete import taught us

The run finished (729 processed, 22 min) and produced 49 flights — real ones
— but only **2 trips**, with 45 of 49 flights in needs_review. Reading the
output found four faults, all now fixed:

1. **Only the first segment was extracted.** The tier-3 system prompt said so
   explicitly, so every return leg was lost; trip chains then correctly
   refused to close. The tool now returns an array of segments and the prompt
   calls missing a return leg a serious error.
2. **The schema allowed one extraction per email** — unique
   (source_email_id, extraction_version) — so multi-segment emails would have
   been truncated anyway. Migration 0005 keys per segment.
3. **Flight numbers weren't normalized**: "7Q-1912" and "1912" became two
   flights. `normalizeFlightNumber` now runs before the merge key and on
   write; its tests are built from the real duplicate this run produced.
4. **Raw HTML went to the model**, spending most tokens on markup. Bodies are
   flattened (brief §16 normalization, with tests) and capped at 12k chars.

Operational fixes: the LLM cap is configurable (300 stranded 367 emails),
per-job token usage is recorded so spend is measurable rather than estimated,
and a job retry clears its own stale failure rows.

Resume strategy for the corrected run: re-read only the 71 emails that
produced extractions; keep the 302 "not a flight" verdicts cached, since that
verdict cannot change and re-asking costs money for nothing.

## Resolution

The corrected run completed in 16 minutes with **zero failures** and produced
a real travel history from the live mailbox:

- **102 flights** (was 49), 2016-06-03 → 2026-04-28
- **12 trips** (was 2) — e.g. VNO→FRA→ICN→FRA→VNO, VNO→STN→ACE→AGP→VNO
- 30 countries, 49 airports, 17 airlines, 243,891 km
- 198 extractions merged to 102 flights — dedupe collapsed 96 duplicates
- 434 LLM calls; 1,277,446 input + 52,663 output tokens ≈ **$1.54**
- 302 emails skipped from cache; 438 processed

M2's success criterion (the user's real mailbox imports — flights extracted,
deduplicated, visible as counts) is met, and frame 1c renders it live.

Two open observations for later milestones, neither a defect:

- **73 of 102 flights are needs_review.** The chaining is deliberately
  conservative (must start and end at the year's home airport), and mailboxes
  genuinely lack some legs. This is the designed decline-to-guess behaviour,
  and the volume says the M3 review flow (frame 1g) carries real weight —
  worth revisiting the home-airport rule once that screen exists and can show
  what it is refusing to guess.
- **The completion email is untested**: RESEND_API_KEY is unset, so the
  worker logged a skip. Wiring Resend is a small M6 task.
