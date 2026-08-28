---
title: Airports and airlines reference data
label: wayfinder:research
status: open
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
