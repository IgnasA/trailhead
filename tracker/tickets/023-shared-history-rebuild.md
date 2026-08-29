---
title: Shared history rebuild module
label: wayfinder:task
status: open
assignee:
map: ../map-manual-flights.md
blocked-by: []
---

## Question

Merge and trip reconstruction — the two stages that turn the truth set into
Flights and Trips — live inline in
[apps/worker/src/pipeline.ts](../../apps/worker/src/pipeline.ts), reachable
only by running an import job that begins with a 16-minute Gmail scan. Adding
one flight by hand cannot wait for that, and reimplementing the same logic in
SQL would put the system's core invariant in two languages that will drift.

Extract both stages into a module both callers share: the worker after
extraction, and a web route handler after a manual add. The extracted module
owns the `delete from flights` → re-derive cycle in one place, so
"Flights are entirely derived from the truth set" stays a single piece of
code rather than a promise.

Done when the worker's behaviour is unchanged — the same 102 flights, 12
trips, 30 countries and 243,891 km rebuild from the existing extractions —
and the module can be invoked without a Gmail read.
