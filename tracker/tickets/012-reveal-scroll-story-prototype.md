---
title: Reveal scroll story prototype
label: wayfinder:prototype
status: closed
assignee: Ignas + Claude (this session)
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

## Prototype

Built: `prototypes/reveal-prototype.html` on branch **`prototype/reveal`**
(one self-contained file — double-click it, or flip variants with the
floating bar / arrow keys):

- **A · Free flow** — one long scroll; each stop reveals and counts up once
  as it enters the viewport. Lowest-friction, least theatrical.
- **B · Hard stops** — CSS scroll-snap; three full-screen stops that play
  their animation when snapped. Closest to the wireframe's "3 stops" read.
- **C · Scrub** — a sticky stage where scroll position drives everything:
  the 132 ticks up under your thumb, rows slot in one per scroll increment,
  routes draw with progress. Most Wrapped-like; fully reversible.

All three use the canonical demo dataset and a static placeholder world map
(real map is MapLibre per the basemap ticket). Awaiting the user's verdict —
that reaction resolves this ticket and sets M5's choreography.

## Resolution

**Verdict: Variant A — Free flow.** One continuous scroll; each stop reveals
and counts up once as it enters the viewport; no scroll hijacking. The user
picked it over B (scroll-snap hard stops) and C (scroll-scrubbed sticky
stage).

Implications for M5 (the reveal build):

- Choreography: IntersectionObserver reveal-once + eased count-ups; route
  draw-in triggered when the map stop enters view. No scroll-snap, no pinned
  stages, no scroll hijack anywhere.
- The prototype (all three variants + switcher) is the primary source:
  branch `prototype/reveal`, `prototypes/reveal-prototype.html`. The M5
  implementation rewrites the winner properly (the prototype is throwaway
  code); the map placeholder is replaced by the real MapLibre component
  (basemap ticket).
