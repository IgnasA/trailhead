---
title: Implement the Trailhead MVP wireframes
label: wayfinder:map
---

## Destination

A working Trailhead MVP that implements the ten frames of
[MVP Wireframes.dc.html](../design/MVP%20Wireframes.dc.html): connect Gmail →
import flight emails → the three-stop reveal → a dashboard (overview, map,
trips, flight detail with provenance) in the Modernist design system, on
desktop and mobile. The map is done when every decision needed to build it is
made and the build itself is either done or handed off as an unambiguous plan.

## Notes

- **Domain**: Trailhead reconstructs a person's flight history from their Gmail
  (scope `gmail.readonly`), stores extracted flight records + message id /
  subject / hash — never email bodies — and presents stats, a route map
  (MapLibre), and derived trips. The wireframes' annotations are load-bearing
  product decisions; read the frame notes before working any ticket that
  touches that frame.
- **Design authority**: [design/MVP Wireframes.dc.html](../design/MVP%20Wireframes.dc.html)
  for structure and copy; [design/_ds/…/styles.css](../design/_ds/modernist-99a44c1e-5f8c-4141-9231-cb5ee9543f2f/styles.css)
  and its [readme](../design/_ds/modernist-99a44c1e-5f8c-4141-9231-cb5ee9543f2f/readme.md)
  for the Modernist look (Archivo, #ec3013 accent, 0 radius, 2px rules,
  flush-left, grayscale imagery). Demo dataset used consistently across frames:
  2019→2026, 132 flights, 47 countries, 91 airports, 312,482 km, 14 airlines.
- **The wireframes cite a product brief by section number** (§13 AI rules, §19
  LLM only for ambiguous cases, §20–21 deterministic aggregations / map rules,
  §31 never persist bodies). That brief is not in this repo — recovering it is
  a ticket, and until then the § notes in the frames are the best proxy.
- **Execution is in scope**: the user asked to *implement* the wireframes, so
  once the decision tickets ahead of an area are closed, build tickets for that
  area graduate out of the fog and are worked in this map rather than handed
  off.
- **Skills**: grilling + domain-modeling for `grilling` tickets, prototype for
  `prototype` tickets, research for `research` tickets. Tracker conventions:
  [tracker/README.md](README.md).
- Supabase MCP tooling is connected in this project's Claude setup — likely the
  intended backend; confirm in [Stack and hosting decision](tickets/003-stack-and-hosting.md),
  don't assume elsewhere.

## Decisions so far

<!-- one line per closed ticket: name (linked) + gist -->

- [Stack and hosting decision](tickets/003-stack-and-hosting.md):
  Next.js/Vercel + fresh Supabase (`eu-central-1`, Auth with combined
  Gmail consent, Realtime, Vault) + one Fly.io worker container carrying the
  kitinerary binary; `import_jobs` table as the job state machine; Resend,
  Sentry, GitHub Actions; pnpm monorepo. Full record: docs/adr/0001-stack.md.
- [Domain model and schema](tickets/009-domain-model-and-schema.md):
  Flight = one segment; two-layer extraction→merge model with provenance
  links; flown/upcoming/cancelled status semantics; derived rebuildable trips
  with corrections as immutable events (= the eval dataset); local wall time
  as source truth. Deliverables: CONTEXT.md + docs/schema.sql.
- [Gmail access and OAuth verification constraints](tickets/004-gmail-access-and-verification.md):
  use `gmail.readonly` alone; dogfood indefinitely in Testing mode (100 test
  users, 7-day token expiry) but never soft-launch unverified (lifetime
  100-user cap); full verification ≈ 6 weeks + annual CASA ($540–$1,800/yr);
  the store/never-store design is Limited-Use compliant; a 1,200-message scan
  takes ~4–5 min against quota.
- [Flight email extraction landscape](tickets/005-flight-email-extraction-landscape.md):
  three-tier funnel — schema.org `FlightReservation` parser, then KDE
  `kitinerary-extractor` sidecar, then Claude Haiku (Batch API, strict
  structured outputs) for ambiguous cases only; deterministic confidence and
  (flight, date, PNR) merging; launch with zero paid flight-data APIs.
- [Airports and airlines reference data](tickets/006-airports-and-airlines-reference-data.md):
  OurAirports for airports (public domain, daily-fresh); timezone computed at
  import via `@photostructure/tz-lookup` and rendered with
  `Intl.DateTimeFormat`; OpenFlights airlines.dat (ODbL, 2017-frozen) as a
  seed for an internally maintained airline table; countries = ISO codes as
  truth, territory folding a display-time decision.
- [Monochrome basemap for MapLibre](tickets/007-monochrome-basemap-for-maplibre.md):
  OpenFreeMap tiles + a custom minimal Positron-derived monochrome style
  (Protomaps PMTiles as the upgrade path); Playwright build-time screenshot
  for the landing teaser; `preserveDrawingBuffer` canvas export for Save as
  image; `@turf/great-circle` pinned 7.3.1.

## Not yet specified

- **Build plan / milestone ordering** — which frames ship in what order once
  stack, schema, and pipeline decisions close; becomes build tickets per area.
- **Extraction eval harness** — the wireframes bake in a feedback loop
  ("Correct this flight" / "Not a flight" / unparsed-email list feed evals);
  how that harness works waits on the extraction pipeline design.
- **Empty states and the settings/delete screens** — the wireframes' own "try
  next" list names them; design + build once the privacy/deletion model closes.
- **"Save as image" share export** — rendering approach decided (canvas
  export per the basemap ticket); the build slice waits on the build plan.
- **Hi-fi visual pass** — the wireframes say it's "a skin, not a re-layout";
  the reveal hi-fi prototype ticket will set the bar for the rest.

## Out of scope

- Social sharing flows beyond the single "Save as image" button — the
  wireframes note sharing isn't on the milestone list.
- The alternative 4-stop reveal with spend stats — offered in the design's
  "try next" list as a variant, not part of the wireframes as drawn. Returns
  only if the destination is redrawn.
