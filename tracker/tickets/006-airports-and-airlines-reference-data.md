---
title: Airports and airlines reference data
label: wayfinder:research
status: closed
assignee: research agent (this session)
blocked-by: []
---

## Question

The product needs reference data: IATA airport codes → name, city, country,
lat/lon (for Haversine distances, computed at import per the wireframes),
timezone (frame 1h shows "17:05 CEST", "11:40 JST +1"), and airline codes →
names. Which dataset(s) should Trailhead vendor?

Compare the candidates (OurAirports, OpenFlights, openflights-derived npm
packages, Wikidata, timezone lookup via lat/lon libraries) on: license
(commercial use?), coverage and freshness, whether IATA→timezone comes free or
needs a lat/lon→tz step, data size if shipped to the client for map rendering,
and maintenance story. Also: country derivation for the "47 countries" stat
(airport country vs geopolitical edge cases).

Resolution: findings file in the repo per the research skill, plus a short
answer here naming the chosen dataset(s) and license notes; the schema ticket
consumes this.

## Resolution

Findings: [docs/research/006-airports-and-airlines-reference-data.md](../../docs/research/006-airports-and-airlines-reference-data.md), with per-claim
primary-source citations and measured dataset stats.

A three-part combination:

1. **Airports: OurAirports** (`davidmegginson/ourairports-data`) — public
   domain (The Unlicense, commercial use explicit), updated daily, 9,054
   IATA-coded airports (of 85,963 rows) with name/municipality/iso_country/
   lat/lon. No timezone field, no airline data. Browser payload fine: a
   6-column IATA-only extract is ~568 KB raw (~268 KB scheduled-service
   only), well under 200 KB gzipped.
2. **Timezone: compute at import, store the IANA zone name.**
   `@photostructure/tz-lookup` (CC0, ~88 KB, maintained fork) for
   lat/lon->IANA at import; `geo-tz` (exact polygons, ~73 MB, Node-only,
   ODbL upstream with unresolved derivative-work status) only if exactness is
   ever needed. Render local times client-side with
   `Intl.DateTimeFormat({timeZone, timeZoneName:'short'})` — produces the
   wireframe's "17:05 CEST" with zero tz data shipped; some zones render as
   "GMT+9" instead of "JST", so keep a tiny abbreviation override map.
3. **Airlines: OpenFlights `airlines.dat` as a seed only** — the only
   substantial open IATA-airline->name list, but ODbL (attribution +
   share-alike, or ~$100 flat commercial license) and frozen since 2017
   (~1,255 active carriers) — seed an internally maintained overlay table.
   All npm shortcut packages rejected: MIT/ISC labels on repackaged
   OpenFlights/OpenTravelData data don't extinguish upstream licenses, and
   all ship stale data.

**Countries visited**: store OurAirports `iso_country` (ISO 3166-1 alpha-2 +
user-assigned `XK` for Kosovo) as truth; territories count separately under
ISO semantics (SJU->PR, HKG->HK), so territory->sovereign folding is a
display-time product decision; downstream ISO lookups must tolerate `XK`.
