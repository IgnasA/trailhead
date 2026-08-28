---
title: Flight email extraction landscape
label: wayfinder:research
status: open
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
