---
title: Editing and deleting a flight you added
label: wayfinder:task
status: closed
assignee: Ignas + Claude (this session)
map: ../map-manual-flights.md
blocked-by: [26]
---

## Question

A typed flight is your input, so you can change it and remove it outright —
update the `manual_flights` row, rebuild, done. No Correction event: there is
no extraction to label as wrong, and putting typed edits into the eval dataset
would poison it.

Extracted flights keep the Correction path and are **not** touched here; what
they should get instead is fog on the map, not a decision this ticket makes.

Deleting the last manual flight has to leave the history correct rather than
merely smaller — the rebuild re-derives trips and the per-year home airport
without it, which is exactly why deletion goes through the shared module and
not a `delete from flights`.

## Resolution

Edit and Remove live where "You added this flight yourself" already is: the
provenance panel on the flight detail page. Both go through the existing
`PATCH`/`DELETE /api/manual-flights` handlers — the definer RPC plus a full
rebuild in one transaction — and both finish on the flights list, because a
rebuild regenerates every derived flight's id, so after either action this
page's address no longer names anything.

- **Edit** expands in place: pickers prefilled with code and place, the date,
  and the optional fields. Save rebuilds and redirects.
- **Remove** is a two-step confirm whose copy tells the truth for the case at
  hand: a pure typed flight gets "this cannot be undone", while one that
  emails also evidence gets "your entry goes, but the flight stays".
- The derived flight carries no pointer to its `manual_flights` row (the merge
  folds them), so the row is found by the identity the merge used — origin,
  destination, date.
- **The Correction path is now hidden on typed flights.** "Correct this
  flight" and "Not a flight" rendered there too; a Correction is a labelled
  example of the extractor being wrong, and a typed flight has no extraction
  to label — its edits are direct, and putting them in the eval dataset would
  poison it. This was the ticket's own boundary, being violated on screen.
- No Correction event is recorded for typed-flight edits, per the ticket.

**Verified in the browser on the live history**: added VNO→LHR 2014-08-03,
edited it to 2014-08-04 (manual row and derived flight both moved, new flight
id as designed, redirect saved the 404), then removed it through the two-step
confirm — 0 manual rows, 102 flights, 12 trips afterwards, the history exactly
as it started. Extracted flights still show the Correction buttons.
