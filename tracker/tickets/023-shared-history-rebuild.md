---
title: Shared history rebuild module
label: wayfinder:task
status: closed
assignee: Ignas + Claude (this session)
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

## Resolution

Merge, trip reconstruction and the history rollup now live in
**`packages/history`**, a workspace package exporting one function:

```ts
rebuildHistory(pool, userId, onStage?) => { flights, flown, trips, countries, airports }
```

The worker calls it after extraction, passing its stage-reporting callback so
the job row still narrates `deduplicate → reconstruct_trips → build_history`.
Anything else can call it with no callback and no Gmail token.
`apps/worker/src/pipeline.ts` went from 394 lines to 253 and now ends at
extraction; `@trailhead/history` is a dependency of both apps and is in the
web app's `transpilePackages`.

**Verified against the live 102-flight history**, invoked directly with no
Gmail read: 102 flights, 102 flown, 12 trips, 30 countries, 49 airports, 73
needs-review, 243,891 km, 198 provenance links — identical to the values the
old inline code produced. 26 domain tests pass; the workspace typechecks.

### A bug the extraction exposed

The UTC derivation (migrations 0008/0009, copied inline into the pipeline) ran
**before** the merge — and the merge's `delete from flights` then threw the
result away. Every fresh import therefore left `dep_utc` and `arr_utc` null,
and the reveal silently fell back to a distance estimate for every single
flight. It was invisible because the one-off backfill migration had populated
the columns once, which is when M5 was verified; the next import erased them.
Confirmed before the change: 102 flights, 97 with local times, **0 with UTC**.

The derivation belongs to "derive Flights from the truth set", so it moved
into the module and now runs after the insert. After the rebuild: **97
departure UTCs, 89 arrival UTCs, 320 measured hours in the air**, and the
reveal's footnote reads "measured where your emails stated both times (87% of
flights)" rather than quietly estimating all of them.

### A finding for the form ticket

The rebuild takes ~21s against the remote database from a laptop — 102 flight
inserts plus 198 provenance links, each its own round trip, latency-dominated.
Fine for a worker; too slow to sit behind a form submit. Batching the inserts
is the obvious fix and belongs in
[The add-a-flight form](026-add-a-flight-form.md), which is the first caller
that has a user waiting on it.
