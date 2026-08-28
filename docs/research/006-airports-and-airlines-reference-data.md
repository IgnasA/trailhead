# Research: airport & airline reference data for Trailhead

Resolves ticket `tracker/tickets/006-airports-and-airlines-reference-data.md`.
Date: 2026-08-28. All claims were checked against the datasets' own sites,
repos, and license texts (primary sources); the "measured facts" were computed
directly against the live data files downloaded on this date.

## Question

Which reference dataset(s) should Trailhead vendor for:

- IATA airport code → name, city, country, lat/lon (Haversine distances are
  precomputed at import)
- timezone (the UI shows local times like "17:05 CEST" / "11:40 JST +1")
- airline code → name

## Recommendation

**Airports: vendor OurAirports** (`airports.csv` + `countries.csv` from
`github.com/davidmegginson/ourairports-data`). Public domain (The Unlicense —
commercial use explicitly allowed), updated daily, 9,054 airports with IATA
codes. It has every field we need except timezone.

**Timezone: precompute at import with a lat/lon→IANA-zone library** —
`@photostructure/tz-lookup` (CC0, ~88 KB, maintained fork of tz-lookup) as the
default; `geo-tz` (MIT code, exact polygons, ~73 MB, Node-only) if we want
exact borders and accept an ODbL question mark on its upstream boundary data.
Store only the IANA zone name (e.g. `Europe/Paris`) per airport; the browser
renders "17:05 CEST" with `Intl.DateTimeFormat` — zero tz data shipped to the
client.

**Airlines: vendor OpenFlights `airlines.dat`** as a seed (there is no better
open bulk source: OurAirports has no airline data, Wikidata is spotty), keep it
in our own repo as an editable overlay table so we can add/correct carriers,
and comply with ODbL (attribution + share-alike on the derived airline table)
or buy OpenFlights' ~US$100 flat commercial license. The file is frozen at
2017, so treat it as a starting vocabulary, not a live feed.

**Countries visited: use OurAirports `iso_country`** (ISO 3166-1 alpha-2 plus
`XK` for Kosovo) joined to its own `countries.csv` for display names, and make
a product decision about dependent territories (see edge cases below).

Estimated browser payload for map rendering: ~268–568 KB uncompressed CSV
(scheduled-service-only vs all IATA airports, 6 columns), well under 200 KB
after gzip — no pruning heroics needed.

## Measured facts (verified directly against the live data, 2026-08-28)

### OurAirports (`airports.csv` from davidmegginson/ourairports-data)

- Full file: 12.7 MB, 85,963 airport rows.
- Rows with an IATA code: 9,054 (4,232 small_airport, 3,400 medium_airport,
  1,169 large_airport, 153 seaplane_base, 100 heliport).
- Rows with an IATA code **and** `scheduled_service=yes`: 4,132.
- Trimmed CSV (IATA rows only; columns iata_code, name, municipality,
  iso_country, lat, lon): ~568 KB. Scheduled-service subset: ~268 KB —
  comfortably shippable to the browser, smaller still after gzip/brotli.
- No timezone column; no airline data anywhere in the project.
- `countries.csv` includes ISO 3166-1 alpha-2 codes with separate entries for
  dependent/disputed territories, verified in the live file: `XK` = Kosovo,
  `TW` = Taiwan, `HK` = Hong Kong, `MO` = Macau, `PR` = Puerto Rico,
  `GF` = French Guiana, `RE` = Réunion, `GU` = Guam, `FK` = Falkland Islands,
  `EH` = "Western Sahara (disputed territory)".

### OpenFlights (`airports.dat`, `airlines.dat` from jpatokal/openflights)

- `airports.dat`: 1.1 MB, 7,698 rows, 6,072 with an IATA code. It **does**
  carry an IANA tz database name per airport, but 1,021 rows (~13%) have it
  missing (`\N`).
- `airlines.dat`: 388 KB, 6,162 rows; only 1,255 flagged active and only
  1,534 have an IATA code at all (many rows are defunct carriers).

### tz-lookup + Intl spot check (run locally, Node)

- `tz-lookup` npm package: 172 KB installed. Spot checks all correct:
  NRT→Asia/Tokyo, CDG→Europe/Paris, DEN→America/Denver, KEF→Atlantic/Reykjavik,
  PPT→Pacific/Tahiti, and the hard case Urumqi (43.91, 87.47)→Asia/Urumqi.
- Browser rendering needs no tz data shipped: given an IANA zone name,
  `Intl.DateTimeFormat(..., { timeZone, timeZoneName: 'short' })` produced
  `17:05 CEST` for Europe/Paris — exactly the ticket's UI example. Caveat:
  Asia/Tokyo yields `00:05 GMT+9`, not `JST` (ICU only has alphabetic
  abbreviations for some zone/locale pairs); the UI should accept GMT+n-style
  suffixes or carry a small zone→abbreviation override map.

## Comparison

### OurAirports — recommended for airports

- **License**: public domain, released under The Unlicense; the site's about
  page confirms free use including commercial use. No attribution required
  (credit is still polite). Source: `ourairports.com/about.html`,
  `github.com/davidmegginson/ourairports-data` (LICENSE).
- **Coverage/freshness**: 85,963 airports, 9,054 with IATA; the
  `ourairports-data` repo is refreshed **daily** (last data commit dated
  2026-08-28, i.e. today).
- **Fields**: ident (ICAO-ish), name, lat/lon, elevation, continent,
  `iso_country`, `iso_region`, `municipality` (city), `scheduled_service`,
  `iata_code`, links, keywords. **No timezone field** (confirmed against the
  data dictionary at `ourairports.com/help/data-dictionary.html`), so IATA→tz
  requires a lat/lon→tz step at import.
- **Airlines**: none.

### OpenFlights — usable only for airlines, with eyes open

- **License**: Open Database License (ODbL) — attribution and **share-alike on
  derived databases**; the site alternatively offers a ~US$100 flat commercial
  license. Source: `openflights.org/data.php`.
- **Freshness**: effectively frozen. `airports.dat` last touched 2019-05-13;
  `airlines.dat` last touched **2017-02-02**; the repo README describes the
  data as snapshots and PRs against the data are not accepted. (Verified via
  `github.com/jpatokal/openflights` commit history.)
- **Airports**: 13% of rows missing the tz name, 7 years stale, and ODbL
  share-alike would attach to our merged airport table — strictly worse than
  OurAirports + computed tz. Not recommended for airports.
- **Airlines**: the only substantial open bulk IATA-airline-code→name list.
  6,162 rows but only ~1,255 active / 1,534 with IATA codes; codes get
  recycled after 2017 (e.g. new carriers founded since then are absent).
  Workable as a seed for an internally-maintained table.

### npm packages derived from the above — not recommended as the source of truth

- `airport-timezone` 1.1.1 (published 2024-04-13): direct IATA→IANA-zone map,
  20,697 entries but only 11,954 unique IATA codes (exact duplicates).
  `package.json` says MIT but the repo has no LICENSE file, and the data comes
  from OpenTravelData `optd_por_public.csv`, which is **CC-BY 4.0** per its
  repo (not deep-verified) — the MIT label does not extinguish the upstream
  data license. Also hard-codes GMT/DST offsets that go stale; only the IANA
  name would be safe to use.
- `@nwpr/airport-codes` 3.0.3: wraps OpenFlights `airports.dat` verbatim
  (7,698 records, 6,677 with tz) — inherits the 2019 freeze, and its ISC label
  conflicts with OpenFlights' ODbL.
- `airline-codes` 1.1.5 (published 2026-06-14): ships OpenFlights 2017
  `airlines.dat` verbatim (6,162 records); same ISC-vs-ODbL mismatch.
- **Pattern**: every npm shortcut repackages OpenFlights or OpenTravelData
  under a permissive label that its upstream data license doesn't support.
  Vendoring the primary files ourselves is both cleaner legally and fresher.

### Wikidata — good license, impractical as the primary feed

- **License**: all statement data is **CC0** (`wikidata.org/wiki/Wikidata:Licensing`).
- **Airports**: P238 (IATA airport code) + P625 (coordinates) + P17 (country)
  exist, but IATA codes legitimately duplicate (Basel–Mulhouse) and also
  appear on railway stations, so queries must filter by instance-of.
- **Timezone**: unreliable — P421 targets admin-area items and P6687 (IANA id)
  lives on the zone items, not airports; the traversal is inconsistently
  populated. No official completeness statistics exist.
- **Airlines**: P229 (IATA airline designator) with start/end-time qualifiers
  handles recycled codes nicely, but coverage must be verified empirically.
- **Verdict**: a good *enrichment/cross-check* source (CC0, continuously
  updated), not the vendored base: requires SPARQL harvesting, dedup logic,
  and quality filtering.

### lat/lon → IANA timezone libraries (import-time step)

- **`@photostructure/tz-lookup` 11.6.1** (maintained fork; original
  darkskyapp/tz-lookup archived 2021): **CC0**, ~88 KB package, last published
  2026-08-08. Uses a compressed timezone map — approximate within a few km of
  borders, which is fine for airports (spot checks above all passed, including
  Asia/Urumqi). Runs anywhere (Node or browser).
- **`geo-tz` 8.1.8**: MIT code, exact polygon lookup from
  timezone-boundary-builder, actively maintained (2026-07-12), but ~73.4 MB
  and Node-only. Its upstream boundary data is **ODbL**; whether a precomputed
  per-airport zone column is an ODbL "derivative database" or a "produced
  work" is legally unresolved — flagged, not settled.
- Since Trailhead computes tz **once at import on the server**, either works;
  tz-lookup's CC0 + tiny size makes it the default, geo-tz the upgrade if a
  border-adjacent airport ever misclassifies.
- **Client side**: `Intl.DateTimeFormat` with `timeZone` +
  `timeZoneName: 'short'` has been in every major browser since ~2017 (MDN) —
  the browser's own ICU/tz data renders local times, so we ship only the zone
  *names* (~20 bytes/airport).

## Country derivation & geopolitical edge cases

OurAirports `iso_country` is ISO 3166-1 alpha-2 plus the user-assigned `XK`
for Kosovo. Verified live: PRN→XK, TPE→TW, SJU→PR, HKG→HK. Consequences for a
"countries visited" stat:

- **Dependent territories count separately** under ISO semantics: Puerto Rico,
  Guam (vs US), Hong Kong, Macau (vs CN), Réunion, French Guiana (vs FR),
  Falklands (vs GB/AR dispute). Flying SJU–MIA would be "2 countries" unless
  we fold territories into sovereigns. Recommendation: keep ISO codes as the
  stored truth and apply an optional territory→sovereign mapping at display
  time (frequent-flyer products differ here; ISO-as-stored keeps both options
  open).
- **Kosovo (`XK`)** is not an official ISO code — any downstream lib doing
  strict ISO lookups (flags, names) must tolerate it.
- **Taiwan (`TW`)** and **Western Sahara (`EH`, labeled "disputed territory"
  in countries.csv)** are politically sensitive labels; using OurAirports'
  own `countries.csv` names keeps us consistent with the upstream dataset
  rather than editorializing.

## Proposed concrete pipeline

1. Vendor `airports.csv` + `countries.csv` (OurAirports, public domain) into
   the repo; re-sync on demand (upstream updates daily).
2. Import step (server): filter to rows with `iata_code`; compute
   `tz = tzLookup(lat, lon)` via `@photostructure/tz-lookup`; precompute
   Haversine distances as already planned; store
   `{iata, name, municipality, iso_country, lat, lon, tz}`.
3. Vendor `airlines.dat` (OpenFlights, ODbL — attribute, and either
   share-alike the derived airline table or buy the flat license) as the seed
   for an internally-maintained `airlines` overlay (adds post-2017 carriers,
   corrections).
4. Browser: ship the trimmed airport subset (~268–568 KB raw) for map
   rendering; render local times with `Intl.DateTimeFormat` using the stored
   IANA zone name, with a small abbreviation override map for zones ICU
   renders as GMT+n (e.g. JST).
5. Optional later: Wikidata (CC0) as a cross-check/enrichment for airline
   names and new carriers.

## Open questions / unverified flags

- Wikidata coverage statistics: none official; verify empirically via SPARQL
  before relying on it.
- ODbL status of a precomputed tz column derived via geo-tz's ODbL boundary
  data (derivative database vs produced work): legally unresolved. Moot if we
  use CC0 tz-lookup.
- OpenTravelData's CC-BY 4.0 licensing was read from its repo but not
  deep-verified (only relevant if we ever adopt `airport-timezone`/OPTD).
- geo-tz per-variant data sizes not broken down (headline ~73.4 MB).
- Whether product wants territories folded into sovereigns for "countries
  visited" — product decision, not a data question.

## Sources (primary)

- OurAirports license/about: https://ourairports.com/about.html
- OurAirports data dictionary: https://ourairports.com/help/data-dictionary.html
- OurAirports data repo (daily updates, The Unlicense):
  https://github.com/davidmegginson/ourairports-data
- OpenFlights data + license terms: https://openflights.org/data.php
- OpenFlights repo (data file commit history):
  https://github.com/jpatokal/openflights
- Wikidata licensing (CC0): https://www.wikidata.org/wiki/Wikidata:Licensing
- Wikidata properties: P238 (IATA airport code), P625 (coordinates),
  P17 (country), P229 (IATA airline designator), P421 (located in time zone),
  P6687 (IANA time zone ID) — wikidata.org property pages
- tz-lookup (archived original): https://github.com/darkskyapp/tz-lookup-oss
- @photostructure/tz-lookup: https://www.npmjs.com/package/@photostructure/tz-lookup
- geo-tz: https://github.com/evansiroky/node-geo-tz
- timezone-boundary-builder (ODbL upstream):
  https://github.com/evansiroky/timezone-boundary-builder
- Intl.DateTimeFormat timeZone support:
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
- npm packages examined: airport-timezone, @nwpr/airport-codes, airline-codes
  (npmjs.com package pages and their repos)
- Live data files measured 2026-08-28:
  https://davidmegginson.github.io/ourairports-data/airports.csv,
  countries.csv;
  https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat,
  airlines.dat
