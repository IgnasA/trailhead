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

## Prototype

Primary source: branch **`prototype/airport-picker`** (commit `f721c34`),
mounted on the real Flights page so each variant sits above the actual
102-row table rather than on an empty route.

- `/dashboard/flights?variant=A` — **Type-ahead.** One combobox per airport;
  arrow keys and Enter; a bare code typed blind and tabbed away never opens
  the list. Your own airports are badged with how often you fly them.
- `/dashboard/flights?variant=B` — **Yours first.** Your 49 airports as chips
  sized by use, tap for departure then arrival; "Search everywhere" is the
  escape hatch rather than the entrance.
- `/dashboard/flights?variant=C` — **Route in one field.** "VNO LHR",
  "VNO-LHR" or "Vilnius to London" in a single input; two codes are taken as
  given, anything ambiguous offers candidates rather than choosing.

`←`/`→` or the floating pill switch variants. Nothing writes.

### What the prototype already settled

Three things it exposed that a mockup would not have:

1. **Ranking by match-class alone is wrong.** Searching "london" puts
   `LOZ` (London, Kentucky) and `YXU` (London, Ontario) above `LTN`, which
   this person has flown **five times** — because their city name starts with
   "london" and Luton's does not, and the personal-history signal is only a
   tiebreak *within* a match class. An airport you have flown must outrank a
   same-named airport on another continent, full stop.
2. **We threw away the field that would rank Heathrow first.** `LHR` comes
   fifth for "london", alphabetically among ties, because the airports table
   has no notion of size. `scripts/vendor-reference-data.mjs:57` *reads*
   OurAirports' `type` (`large_airport` … `heliport`) to skip closed
   airports, then discards it. Re-vendoring with that column is the fix, and
   it is one line plus a migration.
3. **Server-side search is too slow for type-ahead.** ~400ms warm per query
   from a laptop (927ms cold), because each keystroke costs a round trip to
   `eu-central-1` plus a second query for the person's own airports. Either
   ship the index — 9,054 rows of code/city/country is roughly 150KB
   gzipped — or cache the person's own airports client-side and only reach
   the server for the long tail.

### Still open, for the human

Which variant, or which parts of which. Also: on a phone, is B's chip grid
better than a keyboard-first combobox? And should C auto-select when a half
has exactly one candidate, as "vilnius" does?
