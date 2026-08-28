---
title: Domain model and schema
label: wayfinder:grilling
status: open
assignee:
blocked-by: [003, 005, 006]
---

## Question

Pin down the domain model and database schema. The wireframes already imply
most of the entities — model them explicitly (use the domain-modeling skill;
this ticket should produce a CONTEXT.md and the schema):

- **Flight**: route, flight number, airline, departs/arrives with timezones,
  distance (Haversine, precomputed at import), booking ref, price; absent
  fields are stored as absent, never guessed ("not found in source").
- **Provenance** on every flight: `source_email_id`, `extraction_version`,
  `confidence`, `merged_from` (n emails) — first-class, shown in the UI.
- **Source email metadata**: message id + subject + hash (dedupe / skip cache:
  "412 cached, skipped"), email type (confirmation / receipt / check-in),
  never the body; deletable separately from flights.
- **Trip**: derived cluster of flights with an airport chain; flights can be
  *unassigned* ("needs review") when clustering declines to guess; user
  assignment is an auditable correction.
- **Import job**: resumable, batched, per-stage progress counters, per-item
  failures that never abort the job and become a reviewable list.
- **Correction / eval label**: "Correct this flight", "Not a flight", trip
  assignments — stored as labelled examples for extraction evals.
- **Aggregations**: KPIs and superlatives are deterministic queries (no LLM):
  flights, countries, airports, km, airlines, days-in-air, most visited,
  busiest year, longest flight — all filterable by year (URL param).

Blocked by [Stack and hosting decision](003-stack-and-hosting.md) (what
database), [Flight email extraction landscape](005-flight-email-extraction-landscape.md)
(what extraction emits), and [Airports and airlines reference data](006-airports-and-airlines-reference-data.md)
(what reference tables exist).
