---
title: Flight email extraction landscape
label: wayfinder:research
status: closed
assignee: research agent (this session)
blocked-by: []
---

## Question

Before designing the extraction pipeline: what already exists for turning
airline emails into structured flight records, and what do the emails
themselves offer?

1. **Structured markup**: how prevalent is schema.org `FlightReservation`
   JSON-LD/microdata in airline confirmation emails today, which major carriers
   emit it, and how reliable is it? (If most confirmations carry it, the
   "deterministic first, LLM only for ambiguous cases" rule in the wireframes
   gets much cheaper.)
2. **Prior art**: open-source or commercial email-itinerary parsers (e.g. what
   powers TripIt/Flighty-style ingestion, KDE Itinerary's extractor engine,
   any maintained libraries) — what approach do they take, what's reusable,
   what licenses?
3. **LLM extraction patterns**: current best practice for schema-constrained
   extraction with evals (structured outputs, confidence scoring, merging
   multiple emails about one flight — the wireframes show
   `merged_from: 3 emails`, `confidence: 0.98`, `extraction_version: 3`).
4. **Flight enrichment**: given flight number + date, can departure/arrival
   times and airports be resolved without a paid flight-data API, or is one
   needed (which, and at what cost)?

Resolution: findings file in the repo per the research skill, plus a short
answer here recommending the extraction strategy shape (deterministic layers
vs LLM split) for the pipeline-design ticket to grill over.

## Resolution

Findings: [docs/research/005-flight-email-extraction-landscape.md](../../docs/research/005-flight-email-extraction-landscape.md).

Recommended shape — a three-tier deterministic funnel with the LLM strictly at
the edge:

1. **Ingest**: Gmail `format=FULL` (JSON-LD/microdata lives in the HTML part);
   Gmail message id = `source_email_id`.
2. **Tier 1 (deterministic)**: own parser for schema.org `FlightReservation`
   JSON-LD/microdata — maps 1:1 to the product record and is the canonical
   intermediate representation. Coverage is a minority of carriers (Google
   requires sender registration; majors mostly lack usable markup), so it is
   the fast path, not the whole answer. Confidence ~0.95 when present.
3. **Tier 2 (deterministic)**: KDE `kitinerary-extractor` CLI as a sidecar
   (LGPL-2.0-or-later; stdin -> schema.org JSON; bundles hundreds of vendor
   scripts + PDF/boarding-pass barcode decoding). Spike early against a real
   corpus; fall back to home-grown per-carrier parsers if the C++/Qt
   dependency is too heavy.
4. **Tier 3 (LLM, ambiguous only)**: Claude Haiku via the Batch API (50%
   cost — backfill is single-digit dollars) with strict structured outputs
   (`additionalProperties: false`); schema classifies email type
   (confirmation/check-in/cancellation/marketing); escalate rare
   still-ambiguous emails to a stronger model.
5. **Shared post-processing**: validate against OurAirports; compute
   `confidence` deterministically from tier + validation (never use LLM
   self-reported confidence); merge across emails keyed on (flight, date,
   PNR) with source-type precedence -> `merged_from`; golden-corpus
   field-level evals re-run on every `extraction_version` bump.

**Enrichment**: no free API resolves flight number + date -> times for
arbitrary past dates (paid: AeroDataBox $5-30/mo limited lookback, AeroAPI
$100/mo min). Launch with zero paid data — emails carry scheduled times; flag
records missing times as low-confidence instead of buying data.
