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
- **The product brief** the wireframes cite by section number lives at
  [docs/brief.md](../docs/brief.md). Where it and the map's resolved decisions
  differ, the map governs — the deltas are listed in
  [Recover the product brief](tickets/001-recover-the-product-brief.md).
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
- [Privacy and deletion model](tickets/008-privacy-and-deletion-model.md):
  disconnect revokes and deletes nothing; "delete my emails" and "delete my
  history" are independent cascades (history rebuildable from retained
  extractions); account deletion is total; privacy copy has one repo source
  of truth; failure reasons are categorical, never quoted text.
- [Extraction and import pipeline design](tickets/010-extraction-and-import-pipeline-design.md):
  ~200-email batches through fetch/classify/extract with cursor resume;
  synchronous Haiku for ambiguous emails during imports (Batch API only for
  offline re-extraction); deterministic confidence formula; ~$1 LLM cap per
  job degrading to the failure list; eval harness wired to corrections with
  a synthetic fixture floor for CI.
- [Trip reconstruction rules](tickets/011-trip-reconstruction-rules.md):
  per-year home airport; 21-day-gap airport/metro chaining back to home;
  fully deterministic — ambiguity goes to needs_review with a data-bearing
  reason, never to an LLM; correction-touched trips are pinned across
  rebuilds.
- [Build plan](tickets/014-build-plan.md): seven milestones M0 scaffold ->
  M1 auth/connect -> M2 import pipeline (kitinerary spike first) -> M3
  dashboard -> M4 map -> M5 reveal + save-as-image -> M6 settings/polish;
  dogfood after M2, no outside test users before M5; milestones expand into
  build tickets as reached.
- [Recover the product brief](tickets/001-recover-the-product-brief.md):
  found in the design project's uploads via DesignSync; committed as
  docs/brief.md; deltas vs the map's decisions recorded (the map governs).
- [Design sync access](tickets/002-design-sync-access.md): `/design-login`
  done; DesignSync reads the design project directly.
- [Google Cloud OAuth setup](tickets/013-google-cloud-oauth-setup.md):
  done via scripts/setup-google-oauth.sh — Supabase project
  `giylqxatradpvsytpery` (eu-central-1) + Google Cloud `trailhead-506918`,
  consent in Testing mode, gmail.readonly scope, OAuth client wired into
  Supabase Auth. M1 is ungated.
- [Reveal scroll story prototype](tickets/012-reveal-scroll-story-prototype.md):
  verdict = free flow (reveal-once on scroll entry, eased count-ups, route
  draw-in; no scroll-snap or hijack). Primary source on branch
  `prototype/reveal`.
- [M0 scaffold](tickets/015-m0-scaffold.md): monorepo (domain/web/worker)
  typechecking and tested; schema applied to Supabase (11 tables, RLS);
  reference-data vendoring working (9,054 airports / 993 airlines); CI live;
  styling = plain Modernist CSS (fog item resolved). Leftovers: Fly app
  creation + DB seeding, both needing user credentials.
- [M2 import pipeline](tickets/017-m2-import-pipeline.md): live mailbox
  imported end-to-end — 102 flights, 12 trips, 30 countries, 243,891 km in
  16 min for ~$1.54; kitinerary ruled out of the image, extraction is
  schema.org + capped Haiku with a breaker, normalization, and per-segment
  storage.
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

_Nothing — remaining work is build milestones M1–M6 (see the
[Build plan](tickets/014-build-plan.md))._

## Out of scope

- Billing / premium tier (brief §34 M7, §37) — beyond the wireframes'
  destination; its own effort after validation.
- Multiple Gmail mailboxes per user — the MVP is one mailbox per user; the
  schema leaves the door open (`gmail_connections`), but building it is a
  future effort.
- Social sharing flows beyond the single "Save as image" button — the
  wireframes note sharing isn't on the milestone list.
- The alternative 4-stop reveal with spend stats — offered in the design's
  "try next" list as a variant, not part of the wireframes as drawn. Returns
  only if the destination is redrawn.
