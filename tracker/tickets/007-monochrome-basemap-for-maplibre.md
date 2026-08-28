---
title: Monochrome basemap for MapLibre
label: wayfinder:research
status: closed
assignee: research agent (this session)
blocked-by: []
---

## Question

The dashboard map (frame 1f) is MapLibre GL with a monochrome basemap, red
great-circle routes, and airport dots sized by activity; the landing page uses
a static pre-rendered teaser image instead of a live map. What basemap source
should the MVP use?

Compare current options for a grayscale/monochrome vector basemap on MapLibre:
OpenFreeMap, Protomaps (self-hosted PMTiles), MapTiler/Stadia free tiers, and
a minimal self-made style on OpenMapTiles schema. Criteria: cost at MVP scale,
license/attribution requirements, how easily the style can be tuned to the
Modernist palette (#f3f2f2 ground, ink lines, no color), offline/static
export for the landing teaser and the "Save as image" button, and self-host
effort. Also note the standard approach for drawing great-circle arcs in
MapLibre (e.g. turf greatCircle) and any dateline pitfalls for routes like
VNO→NRT.

Resolution: findings file in the repo per the research skill, plus a short
answer here recommending the basemap + styling approach.

## Resolution

Findings: `docs/research/007-monochrome-basemap-for-maplibre.md` on branch
`research/basemap` (commit 3e09662).

- **Tiles**: OpenFreeMap public instance for the MVP — free, explicitly no
  request limits, no API key, commercial use fine, OpenMapTiles schema; only
  cost is the "OpenFreeMap (c) OpenMapTiles, Data from OpenStreetMap" credit.
  Upgrade path if its donation-funded/no-SLA model becomes a risk: self-hosted
  Protomaps PMTiles (single file on S3/Cloudflare, pennies at MVP scale).
  Ruled out: Stadia free tier (no commercial use), MapTiler free tier
  (testing/non-commercial framing + forced logo).
- **Style**: write our own minimal style JSON on the OpenMapTiles schema,
  starting from Positron (hosted by OpenFreeMap) and collapsing to #f3f2f2
  ground / #201e1d ink (~6-8 layer groups). Same style works against a future
  self-hosted OpenMapTiles source.
- **Static exports**: landing teaser = build-time Playwright screenshot of the
  real style + red arcs (wait for `idle`, 2x pixelRatio), shipped as an
  optimized image with attribution beside it (OSM requires static images be
  attributed like interactive maps). In-app "Save as image" =
  `map.getCanvas().toDataURL()` with `preserveDrawingBuffer: true` (or capture
  in a `render` callback); `@watergis/maplibre-gl-export` for DPI/PDF UI.
- **Arcs**: `@turf/great-circle` pinned to 7.3.1 (7.3.2+ has an open
  antimeridian regression, turf#3030). Dateline crossings return a
  MultiLineString — render split, or unwrap longitudes per MapLibre's 180th-
  meridian example. Europe->Japan arcs over Siberia (no dateline);
  transpacific routes are the real test cases.
