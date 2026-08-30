---
title: Choosing an airport from nine thousand
label: wayfinder:prototype
status: closed
assignee: Ignas + Claude (this session)
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

## Resolution

**A's structure, with B's insight as its default state and C's parsing as an
accelerator.** Not three options — one field that behaves three ways depending
on how much the person already knows.

Why, in the order it decided itself:

- **B had the best idea and the worst shape.** Its bet is real and the data
  proves it: 49 airports cover 100% of this history, and VNO alone accounts
  for 54 touches — a flight you are adding almost always departs somewhere you
  have already flown. But as a *layout* it collapses for the person who needs
  manual entry most: someone whose import found almost nothing gets an empty
  grid and a lone "Search everywhere" button. The idea survives; the chip grid
  does not.
- **C is the fastest input in the product and the wrong default.** "VNO LHR"
  beats everything for someone who thinks in codes, but a large empty box
  captioned `VNO LHR` teaches nothing to someone who thinks in cities, and
  route parsing is a category of surprise ("Vilnius to London Ontario"?). It is
  a power-user accelerator wearing the costume of a primary interface.
- **A is the only one that works from zero flights to a hundred**, and the only
  one that is obviously right on a phone: one field at a time, native focus
  behaviour, no two-dimensional target grid under a thumb.

### What to build

1. A combobox per airport, keyboard-first (arrows, Enter, Escape), matching on
   code, city and airport name.
2. **On focus, before a keystroke, the dropdown lists the person's own
   airports, most-flown first.** That is B delivered inside A's affordance:
   zero typing in the common case, and no dead surface for a new user — the
   list simply starts empty and fills as they type.
3. **A bare code typed blind and tabbed away is a complete answer** and never
   opens the list.
4. **A route pasted into the origin field splits across both fields** when it
   parses as two codes. That is C as an accelerator discovered by accident: one
   regex, no explaining.
5. **Auto-select when a search returns exactly one candidate.** Confirming a
   choice that has no alternatives is a click that buys nothing.

### Three findings promoted to requirements

1. **Personal history outranks match class, unconditionally.** Searching
   "london" currently puts `LOZ` (London, Kentucky) and `YXU` (London,
   Ontario) above `LTN`, flown five times, because their municipality starts
   with the query and Luton's does not. That is not a ranking nuance; it is the
   feature failing at its only job.
2. **Re-vendor OurAirports' `type` column.**
   `scripts/vendor-reference-data.mjs:57` reads it to skip closed airports and
   then discards it, so nothing in the system can rank Heathrow above Biggin
   Hill — `LHR` comes fifth for "london", alphabetically among ties. One line
   plus a migration.
3. **Cache the person's own airports client-side; do not ship the index.**
   Own-airports-first means the common case makes *no request at all*, which
   answers the latency finding (~400ms warm, 927ms cold per query) far better
   than shipping ~150KB of gzipped index that only pays off for strangers'
   airports.

### Left deliberately unsettled

Whether the dropdown-on-focus reads as a shortcut or as clutter at real
density. It cannot be settled from the data, and the build should treat it as
adjustable — if it reads as a wall, a compact chip row above the fields for the
first few entries is the fallback.

Primary source: branch `prototype/airport-picker` (`f721c34`). The variants and
the switcher are not promoted — they were written under prototype constraints,
and the winner is rewritten properly in
[The add-a-flight form](026-add-a-flight-form.md).
