---
title: Monochrome basemap for MapLibre
label: wayfinder:research
status: open
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
