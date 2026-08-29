---
title: Manual flights, schema and rebuild integration
label: wayfinder:task
status: open
assignee:
map: ../map-manual-flights.md
blocked-by: [23]
---

## Question

Add the third truth source, without weakening the invariant.

- A **`manual_flights`** table: durable user input, owned by the user, read by
  the rebuild alongside `email_extractions`. Not a row in `flights` with an
  exception carved into the delete, and not a `Correction` — CONTEXT.md
  defines a Correction as an action *on a Flight*, and the correction set is
  the extractor's labelled eval dataset; a flight you typed is not an example
  of an extraction being wrong.
- Required columns: origin, destination, departure date. Optional: airline,
  flight number, local departure and arrival times, booking reference, price.
  There is no flight *schedule* reference data in this repo, so `LH710` on a
  date genuinely cannot be resolved to a route — the route must be given.
- A **`source`** column on `flights` (`imported` | `manual`) so the UI can
  branch on provenance. `confidence` is `not null check (between 0 and 1)`:
  store `1.0` and never render it as a number for a manual flight.
- Stamp the current `extraction_version` so re-extraction sweeps treat manual
  flights uniformly.
- The rebuild derives everything else exactly as it does for extracted
  flights: haversine distance, timezones from the airport table, `flown` vs
  `upcoming` from date-versus-today. Two typed flights with the same merge key
  merge like any other duplicate; a later import that finds a flight you
  already typed merges into it, **with the typed values winning on conflict**.
- Manual flights participate in trip reconstruction **including the per-year
  home-airport inference** — a flight that counted in the stats but not in
  your trips would be a worse lie than the gap it filled.
- RLS in the established shape: `security definer` RPCs, `user_id = auth.uid()`.

Done when a row inserted into `manual_flights` produces a Flight that the
dashboard, map, trips and reveal treat identically to an extracted one.
