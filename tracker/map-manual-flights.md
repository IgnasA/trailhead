---
title: Add your own flight data
label: wayfinder:map
---

## Destination

Anyone can add a flight Trailhead didn't find — typed by hand, counting in
every stat, map, trip and reveal exactly like an imported one. Ungated on both
tiers — counted, not capped. The map is done when a typed flight is
indistinguishable from an extracted one everywhere downstream, and the one
place it *is* distinguishable — its provenance — tells the truth.

## Notes

- **Domain**: see [CONTEXT.md](../CONTEXT.md). This effort adds a third truth
  source alongside Extractions and Corrections. The invariant it must not
  break: **Flights are entirely derived and rebuildable** — the import runs
  `delete from flights where user_id=$1` and re-derives everything
  ([pipeline.ts:281](../apps/worker/src/pipeline.ts)), and that must stay true.
- **Tiers today**: Free (€0, everything built) and Premium (€30/yr, *not
  built*, interest-only — there is no billing anywhere in the product). A cap
  was charted first at twenty, then at five, and then dropped: it would have
  truncated the one measurement it existed to produce. Entry is counted and
  asked about once instead — see [Counting, not capping](tickets/027-counting-not-capping.md)
  and [Extraction cost reduction and the plan step](tickets/022-extraction-cost.md).
- **Execution is in scope**: as with the wireframes map, tickets here build
  as well as decide.
- **Design authority**: the Modernist system, as everywhere else. There is no
  wireframe frame for adding a flight — the ten frames don't cover it — so the
  one genuinely open visual question (the airport picker) gets a prototype
  ticket rather than a guess.
- **i18n-ready, not internationalized**: the form must not add to the debt —
  `<input type="date">` so the browser renders the user's own format, airports
  chosen by IATA code and name rather than English text search, and no
  sentences assembled from concatenated fragments. Actually internationalizing
  the app is out of scope; see below.
- **Skills**: grilling + domain-modeling for `grilling` tickets, prototype for
  `prototype` tickets. Tracker conventions: [tracker/README.md](README.md).
- Predecessor map: [Implement the Trailhead MVP wireframes](map.md), complete.

## Decisions so far

<!-- one line per closed ticket: name (linked) + gist -->

- [Shared history rebuild module](tickets/023-shared-history-rebuild.md):
  merge, trips and the history rollup extracted to `packages/history` as
  `rebuildHistory(pool, userId, onStage?)`, callable without a Gmail token;
  the worker's output is byte-for-byte the same 102 flights / 12 trips /
  243,891 km. Exposed and fixed a live bug — UTC derivation ran *before* the
  merge deleted and re-inserted every flight, so no import had ever left a
  UTC behind and the reveal was estimating all durations. Now 320 hours are
  measured. Batching the inserts is left for the form ticket (~21s as-is).

- [Manual flights, schema and rebuild integration](tickets/024-manual-flights-schema.md):
  `manual_flights` + `flights.source` + three definer RPCs, applied; the
  rebuild folds typed flights into the same merge, typed values winning on a
  shared key while email provenance survives. Verified live in a rolled-back
  transaction — a typed flight becomes a real Flight, a typed duplicate merges
  to one row keeping its five email links, and the runaway guard fires at 50.

## Not yet specified

- **Bulk entry.** Anyone with a hundred flights in another app wants to paste
  a CSV, not fill a form a hundred times. Its own column-mapping, validation
  and preview problem, and far easier to design once single entry has settled
  what a manual flight *is*. Revisit when this map closes.
- **A manual-only front door.** Signing up and never connecting Gmail. Today
  `/plan` and `/dashboard` bounce you to `/connect`, and the landing page, the
  plan step and the reveal all assume an import happened. A funnel redesign,
  not a form change — though this map removes the redirect trap so a
  manual-only user isn't ejected from their own dashboard.
- **Editing an *extracted* flight.** The Correction path (`correct_field`)
  exists in the schema and is unused by the UI. Typed flights get real edit and
  delete in this map; whether extracted flights get the same treatment, or
  something deliberately different because their values have provenance, isn't
  sharp enough to ticket yet.

## Out of scope

- **Internationalization**, all three strands, ruled out during charting so the
  destination stays "you can enter flights we missed". Worth its own map, and
  the finding that prompted it is worth keeping:
  - **A. UI language** — copy is hardcoded English in TSX and in
    `packages/domain/src/privacy.ts`; translating the privacy copy is a
    legal-review problem, not a translation one.
  - **B. Locale-correct formatting** — 25 call sites. `formatLocal` hardcodes
    `Intl.DateTimeFormat("en-GB", …)`, dates render as raw ISO, bare
    `toLocaleString()` picks up the server locale, €30 is hardcoded. A bug
    today rather than a missing feature.
  - **C. Multilingual input, the one that costs data.** The pre-filter's
    *necessary* evidence is language-neutral (`FLIGHT_NUMBER_PATTERN`,
    `ROUTE_PATTERN` — IATA codes and digits), and `GMAIL_SEARCH_QUERY` leans on
    `category:travel`, which is Gmail's own language-independent
    classification. But the *confirming* half is
    `AIRLINE_SENDERS` (30 domains) **or** `FLIGHT_KEYWORDS` (English words
    only), so a non-English booking from a sender not on that list — a regional
    OTA, a charter operator, a corporate travel desk — is dropped before
    extraction. Silent, and invisible to the person it happens to. If that map
    is ever charted, C is its destination, not A.
- **Billing for Premium.** Manual entry is the first feature to put a real
  number on who wants more than the free product, which sharpens the question
  without answering it. Still its own effort after validation, as ruled in the
  predecessor map.
