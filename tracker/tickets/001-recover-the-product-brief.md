---
title: Recover the product brief
label: wayfinder:task
status: closed
assignee: Ignas + Claude (this session)
blocked-by: []
---

## Question

The wireframes' annotations cite a numbered product brief that is not in this
repo — §13 (AI rules), §19 (LLM only for ambiguous cases), §20–§21
(deterministic aggregations; don't overload the map), §31 (never persist email
bodies), and the landing headline is "verbatim from the brief". Locate that
brief (likely the Claude Design chat or a document that fed it) and commit it
to the repo (e.g. `docs/brief.md`), so tickets can cite the real sections
instead of second-hand fragments.

HITL: only the user knows where the brief lives. If it turns out not to exist
as a document, resolve by writing down that fact — the frame annotations then
become the canonical rules and should be extracted into `docs/` instead.

## Resolution

Found and committed: [docs/brief.md](../../docs/brief.md) — the 46-section
"Travel Intelligence SaaS — AI Agent Project Brief", recovered from the design
project's `uploads/` folder via DesignSync (it became reachable once
`/design-login` ran). Every § the wireframes cite checks out (§13 AI rules,
§19 trips/LLM-only-for-ambiguous, §20 Haversine, §21 dashboard/map, §31
source-email handling).

Deltas between the brief and the map's later, research-backed decisions — the
map governs, brief header says so:

- **§6 backend**: brief says "no separate backend unless clear need"; the map
  adds the Fly worker — the clear need (kitinerary sidecar, 4-5 min scans) is
  documented in docs/adr/0001-stack.md.
- **§6 frontend styling**: brief recommends Tailwind + shadcn/ui; the
  wireframes' Modernist design system (plain CSS tokens, 0 radius) is the
  design authority and clashes with shadcn defaults. Styling approach is an
  open M0/M1 build decision — returned to the map's fog.
- **§12/§14 LLM-primary extraction**: the pipeline ticket strengthened this
  to deterministic-first tiers (schema.org → kitinerary → LLM), which is
  §41's own principle applied harder.
- **§29 eval corpus**: brief targets ~100 fixtures across named carriers —
  adopted as the fixture-set target (supersedes the pipeline ticket's "a
  dozen" floor).
- **§34/§42 ordering**: the build plan's M0-M6 reorders the brief's list with
  concrete reasons (risk-first spikes, reveal-before-testers gate).
- **§34 M7 billing**: beyond this map's destination (the wireframes) — noted
  out of scope; returns as its own effort.
