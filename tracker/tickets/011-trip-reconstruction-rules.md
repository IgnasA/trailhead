---
title: Trip reconstruction rules
label: wayfinder:grilling
status: closed
assignee: Ignas + Claude (this session)
blocked-by: [009]
---

## Question

Define the deterministic rules that cluster flights into trips (frame 1g).
The wireframe fixes the behavior at the edges: trips display as an airport
chain with the destination highlighted (users audit the reconstruction at a
glance), and when the algorithm isn't confident it *declines to guess* — the
flight surfaces as "Unassigned — needs review" with a stated reason ("No
return leg found and a 9-day gap either side — we didn't guess"), and the user
assigns it manually, producing a labelled example.

Grill to decide: the clustering heuristics (home-airport inference,
gap-days thresholds, open-jaw and one-way handling, multi-leg chains), what
confidence threshold routes a flight to "needs review" instead, whether §19's
"LLM only for ambiguous cases" applies here or only to extraction, how the
human-readable "why we didn't guess" reason is generated, and how a manual
assignment updates the model (and whether it retro-triggers re-clustering).

Blocked by [Domain model and schema](009-domain-model-and-schema.md) — the
trip/flight/correction entities must exist first.

## Resolution

One grilling round, all recommendations accepted:

- **Home airport**: computed per calendar year (modal first-departure /
  last-arrival airport); user override later via Correction.
- **Clustering**: flights sorted by departure; consecutive flights chain when
  the next departs from the previous arrival's airport or metro area (small
  metro table for LHR/LGW/STN-class cases; fallback: same country within
  500 km) within a 21-day gap; a Trip = maximal chain starting at and
  returning to that year's home airport.
- **Decline-to-guess**: a flight joining no chain -> `needs_review` with a
  templated, data-bearing reason generated from the rule that failed ("No
  return leg found and a 9-day gap either side — we didn't guess"). One-way
  from home with no return: unassigned.
- **No LLM in clustering** — §19 applies to extraction only; ambiguity routes
  to the human, whose assignment becomes an eval label.
- **Pinning**: any trip touched by a Correction is pinned — it survives
  rebuilds and clustering never moves its flights; rebuilds re-derive only
  unpinned trips from unpinned flights.
