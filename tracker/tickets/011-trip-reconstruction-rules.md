---
title: Trip reconstruction rules
label: wayfinder:grilling
status: open
assignee:
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
