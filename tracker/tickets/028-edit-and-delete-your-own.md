---
title: Editing and deleting a flight you added
label: wayfinder:task
status: open
assignee:
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
