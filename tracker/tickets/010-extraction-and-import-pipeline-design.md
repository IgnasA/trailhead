---
title: Extraction and import pipeline design
label: wayfinder:grilling
status: closed
assignee: Ignas + Claude (this session)
blocked-by: [003, 004, 005]
---

## Question

Design the import pipeline behind frame 1c. The wireframe fixes the stage list
— connect → search mailbox → skip cached → extract flights → deduplicate →
reconstruct trips → build history — and several properties: every stage has a
real counter (no fake easing), per-item failures never abort the job and
surface as a reviewable list, the job is resumable and batched ("batch 3 of
7"), the user can close the tab and get an email on completion, and re-imports
are fast because of the hash cache.

Grill to decide: the deterministic-vs-LLM split per the extraction-landscape
findings (which layers run in what order; when is a case "ambiguous" per §19),
which LLM and structured-output approach for the ambiguous tier, cost controls
and budget per import, batch sizing against Gmail quotas, how progress state is
stored and streamed to the page, retry/resume semantics, dedupe/merge rules
that produce `merged_from`/`confidence`, and how the unparsed-email list and
user corrections feed the eval dataset.

Blocked by [Stack and hosting decision](003-stack-and-hosting.md) (where jobs
run), [Gmail access and OAuth verification constraints](004-gmail-access-and-verification.md)
(quotas, sync mechanics), and [Flight email extraction landscape](005-flight-email-extraction-landscape.md)
(what to build on).

## Resolution

Two grilling rounds, all recommendations accepted:

- **Batching**: search yields candidate ids -> batches of ~200 through
  fetch -> classify -> extract; global stages (dedupe -> trips -> history)
  run once after; resume point = (stage, batch, offset) in the job cursor.
- **LLM tier runs synchronously** (Claude Haiku) during interactive imports —
  amends the extraction-landscape recommendation: the Batch API's latency
  breaks the magic-moment promise; Batch is reserved for offline
  re-extraction campaigns on `extraction_version` bumps.
- **LLM admission**: tier 1 (schema.org) -> tier 2 (kitinerary) -> cheap
  deterministic pre-filter decides LLM vs skip; LLM "not a flight" is cached
  forever; LLM parse failure -> failure list.
- **Confidence**: deterministic base-plus-modifiers (schema.org 0.95,
  kitinerary 0.90, LLM 0.75, adjusted by validation checks), constants in
  `packages/domain`, versioned with `extraction_version`.
- **Cost cap**: hard LLM ceiling per job (~300 calls / ~$1); hitting it
  degrades to the failure list — jobs never fail for budget reasons.
- **Progress**: job-row counter updates at most ~1/sec (Realtime fan-out);
  completion email always sends (Resend); re-imports via stored `historyId`,
  falling back to full search + hash skip-cache.
- **Eval harness**: every correction and resolved failure auto-becomes a
  golden-corpus case; a synthetic fixture set in the repo is the floor CI
  always runs on (real-email-derived cases never leave the database — Limited
  Use); field-level evals run on PRs touching extraction code, an
  `extraction_version` bump requires the eval report; re-extraction over real
  data runs manually, reporting aggregate diffs only.
