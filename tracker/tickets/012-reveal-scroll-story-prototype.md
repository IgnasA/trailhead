---
title: Reveal scroll story prototype
label: wayfinder:prototype
status: open
assignee:
blocked-by: []
---

## Question

Take frame 1d — the three-stop reveal (the hook: one huge number + "16 days in
the air"; the stack: ruled stat rows snapping into place on scroll, km in red;
the map lands: full-bleed routes drawing in, then exactly two exits) — to a
hi-fi interactive prototype in the Modernist system, per the design's own "try
next" suggestion. Desktop (820px frame) and mobile (frame 1i).

The question the prototype answers: does the scroll choreography *feel* like
the magic moment the product bets on — scroll-snap vs free scroll, row
snap-in timing, count-up behavior, when routes draw — before the real
dashboard exists. Use the canned demo dataset (132 flights, 47 countries, 91
airports, 312,482 km, 14 airlines, 2019→2026) and a placeholder for the map
stop (the real basemap choice is
[Monochrome basemap for MapLibre](007-monochrome-basemap-for-maplibre.md);
don't block on it — a static SVG world outline is fine for judging the
choreography).

HITL: build cheap, then react together. Link the prototype from this ticket
when it exists.
