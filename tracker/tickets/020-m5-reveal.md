---
title: M5 reveal
label: wayfinder:task
status: closed
assignee: Ignas + Claude (this session)
blocked-by: []
---

## Question

Build milestone M5: the three-stop reveal (frames 1d/1i) in the free-flow
choreography chosen from the prototype, on real data, plus "Save as image".

## Resolution

- **The three stops**, free flow: the hook (one huge count-up plus time in
  the air), the stack (ruled rows that slot in with a stagger, kilometres in
  red) with the four superlatives, and the map landing with routes drawing
  in. Each stop reveals once on entry; nothing hijacks scrolling.
  `prefers-reduced-motion` skips every animation to its end state.
- **Two exits only**: the dashboard, and **Save as image** — a PNG composed
  in the browser from the live map canvas plus the numbers, nothing uploaded.
  The canvas is readable because `preserveDrawingBuffer` is set at map
  creation (basemap ticket anticipated this). Verified: 250 KB PNG with real
  map pixels.
- **`reveal_stats()`** computes flights, countries, airports, km, airlines,
  time in the air, and all four superlatives in one deterministic query
  (brief §20/§21). Country codes render through `Intl.DisplayNames`.

## Making "time in the air" honest

The wireframe's "You've been in the air for 16 days, 4 hours" turned out to
be the hardest honest number in the product.

- **No flight had UTC timestamps**: the pipeline stored only local wall times,
  so every duration silently fell back to a distance estimate. UTC is now
  derived from the local time and the airport's IANA zone — on import, and by
  migration 0008 for existing rows. That took measured coverage from 0% to
  94 of 102 flights.
- **That surfaced a 23-hour hop to Stockholm.** Cause: the known wrong-airport
  extraction (`VIL`, Morocco, standing in for Vilnius) gave the origin a
  Moroccan timezone, and arrivals are extracted as a time with no date, so a
  midnight-rollover has to be inferred — and the inference compounded the
  error.
- **Fix (migration 0009)**: where an inferred arrival contradicts what the
  great-circle distance allows, we do not know the arrival, so it is set back
  to null and the estimate is used. Fabricating an interval would break the
  product's central promise.
- The reveal states the split: measured for 87% of flights, estimated for the
  rest. The number shown is "about 15 days, 17 hours".
