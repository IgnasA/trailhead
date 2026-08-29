---
title: Choosing an airport from nine thousand
label: wayfinder:prototype
status: open
assignee:
map: ../map-manual-flights.md
blocked-by: []
---

## Question

Origin and destination are the only two fields that are genuinely required,
and both are a choice from 9,054 vendored airports. Typing "Vilnius" has to
find `VNO`; typing "VNO" has to find it faster; typing "London" has to offer
six airports without pretending to know which. This is the one interaction in
this map the ten wireframe frames don't cover, so it gets a rough artifact to
react to rather than a guess.

What to settle: whether search matches code, city and airport name (and in
what precedence); how results are ranked when the user has a history that
makes some airports far likelier than others; whether the field accepts a
bare IATA code typed blind, without opening the list; how it behaves on a
phone; and what it does when nothing matches.

The reference table is local, so search can be a server round-trip or a
shipped index — decide which by what the interaction needs, not the reverse.

Constraint from the map: airports are chosen by code and name, never by
English-only text search, so this doesn't add to the i18n debt.
