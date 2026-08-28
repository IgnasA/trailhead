---
title: M3 dashboard
label: wayfinder:task
status: closed
assignee: Ignas + Claude (this session)
blocked-by: []
---

## Question

Build milestone M3: the dashboard data views — overview (1e), trips (1g),
flight detail with provenance and live source fetch (1h), and the mobile
layout (1j).

## Resolution

Built and verified against the real 102-flight history:

- **Overview (1e)**: five KPI cells split by rules, per-year bars that double
  as the year picker with the busiest year in red (computed, not configured),
  recent flights. Aggregates are `dashboard_stats(year)` and
  `flights_per_year()` — deterministic SQL per request, no caches
  (migration 0006).
- **Trips (1g)**: trips render their derivation as an airport chain with the
  destination in red; the needs-review queue states why each flight was not
  placed, and links to it.
- **Flight detail (1h)**: provenance block (tier, extraction_version,
  confidence, merged_from) and absent fields reading "not found in source".
  The source email is fetched **live** from Gmail through a server route that
  reads the Vault token — never persisted, never sent to the browser — and
  the values we extracted are highlighted in the original text.
- **Mobile (1j)**: columns stack, KPI row becomes a 2-up grid.
- The year filter is a URL param that nav links and views carry, as decided.

Three bugs the real data exposed, all fixed:

1. **Chains broke on same-day legs.** Date-only sorting made VNO→STN→ACE read
   as STN→ACE→STN; ordering now walks the connections, anchoring round trips
   (closed loops, where no origin is missing from arrivals) on the trip's
   start airport.
2. **The wrong stop was highlighted** — the longest leg's arrival, which for
   a round trip is the flight home. It is now the stop farthest from home by
   great-circle distance, so Seoul and Zürich highlight rather than VNO.
3. **PostgREST's 1000-row cap** silently truncated an unfiltered `airports`
   select, leaving most stops without coordinates; the query now fetches only
   the airports the flights touch.

Also fixed in passing: plain-text email parts padded with CRLF runs (a real
itinerary was 8.5k chars, 2.3k of it padding) rendered as an empty source
panel and were being paid for on every extraction. `tidyText` now collapses
them, with tests.

## Extraction-quality findings for the eval dataset (M6)

Visible in the flights table, worth capturing as eval cases rather than
patching blind:

- `VIL → ZRH` where Vilnius is `VNO` — VIL is Dakhla, Morocco. The wrong code
  passed validation because it is a real airport, and it produced a 3,415 km
  distance instead of 1,411 km.
- `TW 292` and `BX 292` on the same date and route stored as two flights —
  codeshares share a number under different carriers, so the merge key needs
  a codeshare rule.
- One flight merged from 8 emails including cancellations, yet is still
  `flown` — cancellation emails should influence status, not just merge in.
