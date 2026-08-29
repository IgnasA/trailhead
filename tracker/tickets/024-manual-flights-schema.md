---
title: Manual flights, schema and rebuild integration
label: wayfinder:task
status: closed
assignee: Ignas + Claude (this session)
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

## Resolution

Migration `00000000000012_manual_flights.sql`, applied. `manual_flights` holds
the typed rows; `flights.source` (`imported` | `manual`) records which truth
source produced each Flight. Writes go through three definer RPCs —
`add_manual_flight`, `update_manual_flight`, `delete_manual_flight` — each
scoped to `auth.uid()`, with owner-read RLS on the table.

`rebuildHistory` now reads `manual_flights` alongside `email_extractions` and
folds them into the *same* merge, through the same `mergeKey`. Where a typed
flight shares a key with an extracted one they become one Flight, the typed
values win, and the email links survive so provenance can show both. A typed
flight gets `confidence = 1.0` (stored, never rendered as a percentage) and
otherwise goes through every derivation an extracted flight does: haversine
distance, airport timezones, UTC, flown-vs-upcoming, trip chaining.

`rebuildHistory` also now takes a `Queryable` rather than a `pg.Pool`, so a
caller can run it inside its own transaction — which is how this was tested,
and how the form ticket will roll back a failed add. `@trailhead/history` no
longer depends on `pg` at all.

**Verified against the live history, in a transaction rolled back afterwards:**

- A typed `VNO → LHR` with no email behind it became a Flight: 1,746 km,
  `Europe/Vilnius`, local time stored, UTC derived, zero provenance links.
  Totals moved 102 → 103 flights and 49 → 50 airports.
- A typed duplicate of an extracted `NK696 LAS → BWI` **merged into one row**
  (not two), kept all five of its email provenance links, and took the booking
  reference the extraction never had — manual winning on conflict.
- The runaway guard raised `manual_flight_limit` on the 51st insert.
- Cleanup restored exactly 102 flights, 12 trips, 30 countries, 49 airports.

Separately confirmed in SQL that the UTC fix from
[Shared history rebuild module](023-shared-history-rebuild.md) is correct and
not merely populated: Tokyo 09:55 → 00:55Z, Seoul 12:45 → 03:45Z, Copenhagen
10:40 → 09:40Z after the DST change, and HND→CPH measures 14.6h westbound
against 13.3h eastbound over the same 8,709 km.

`CONTEXT.md` gains **Manual Flight** and **Source**, and **Merge** is amended
to name both inputs. `docs/schema.sql` records the new table and column.
