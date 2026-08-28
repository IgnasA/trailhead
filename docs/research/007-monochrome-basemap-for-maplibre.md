# Research: Monochrome basemap for MapLibre GL (ticket 007)

Date: 2026-08-28 · Branch: `research/basemap` · Status: resolved

Question: what basemap source should the Trailhead MVP use for a strict-monochrome
MapLibre GL map (ground `#f3f2f2`, ink `#201e1d`, only color on screen = red data
layer), considering cost at MVP scale, license/attribution, ease of tuning to the
palette, static export (landing teaser + "Save as image"), and self-hosting effort?

There is no such thing as a "grayscale tile" for vector maps — color lives entirely
in the MapLibre style JSON, and every candidate below serves OpenStreetMap-derived
vector tiles (OpenMapTiles schema or Protomaps schema). So the real comparison is
**who serves the tiles** (cost/limits/licensing) plus **which schema the style JSON
targets** (tuning effort). The strict two-color palette means we will end up writing
or heavily recoloring a style either way.

## Recommendation (TL;DR)

1. **Tiles: OpenFreeMap public instance** for MVP — free, no API key, no request
   limits, commercial use fine, OpenMapTiles schema. **Fallback/upgrade path:
   self-hosted Protomaps PMTiles** (single file on S3/Cloudflare, "pennies" at MVP
   scale) if OpenFreeMap's no-SLA/donation-funded model becomes a concern.
2. **Style: our own minimal style JSON on the OpenMapTiles schema**, started by
   recoloring Positron (OpenFreeMap ships it) down to exactly `#f3f2f2` /
   `#201e1d`. The same style JSON works unchanged against self-hosted OpenMapTiles
   tiles later. (If we switch to Protomaps tiles, regenerate via
   `@protomaps/basemaps` `layers(source, flavor)` with a custom two-color Flavor —
   equally easy, different schema.)
3. **Landing teaser: build-time screenshot** of the real map (Playwright/CI
   against the same style + red arcs), shipped as an optimized static image.
   Never a live map instance on the landing page. Server-side
   `@maplibre/maplibre-gl-native` is the headless alternative if we want it in
   the build pipeline without a browser.
4. **"Save as image": `map.getCanvas().toDataURL('image/png')`** with
   `canvasContextAttributes: { preserveDrawingBuffer: true }` (or capture inside a
   `render` event to avoid the always-on buffer cost); `@watergis/maplibre-gl-export`
   if we want PNG/PDF + DPI controls for free.
5. **Great circles: `@turf/great-circle`** — but **pin 7.3.1** (7.3.2+ has an open
   antimeridian regression, turf#3030). Render the returned MultiLineString as-is,
   or unwrap longitudes past ±180 per the official MapLibre example if we want one
   unbroken arc.

Attribution in all cases: OSM + OpenMapTiles (+ host) in a map corner; static
images need the same credit near the image.

---

## 1. Basemap source comparison

### OpenFreeMap (public instance)

- **Cost:** Free. "There are no limits on the number of map views or requests";
  no registration, no API keys. Donation-funded (GitHub Sponsors).
  — https://openfreemap.org/
- **License/attribution:** OSM data; required credit "OpenFreeMap © OpenMapTiles
  Data from OpenStreetMap" (MapLibre adds it automatically from the style).
  — https://openfreemap.org/
- **Tuning:** Serves OpenMapTiles-schema tiles with hosted styles including
  **Positron Bright** (their neutral/minimal option), plus Liberty, Dark, Fiord, 3D.
  Style JSON is ours to copy and recolor — full control down to two hex values.
- **Static export:** No static-maps API, but none needed with the build-time
  screenshot approach (section 3).
- **Self-hosting effort:** Zero to start (public instance); the whole stack is
  open source on GitHub if we ever want our own server. — https://openfreemap.org/
- **Risk:** No SLA; sustainability depends on sponsorship. Mitigated by the
  Protomaps/self-host fallback (same MapLibre app code, different source + style).

### Protomaps (self-hosted PMTiles)

- **Cost:** Daily planet build is a free download (~120 GB, z0–15); `pmtiles
  extract` pulls a region, `--maxzoom` trims size. Hosting is a single file on
  S3/Cloudflare/GCS/Azure read via HTTP Range Requests — Protomaps positions it as
  reducing map bills "from hundreds per month to pennies."
  — https://docs.protomaps.com/basemaps/downloads, https://docs.protomaps.com/pmtiles/,
  https://protomaps.com/
- **Hosted API alternative:** free for noncommercial use; commercial use = become a
  GitHub Sponsor. — https://protomaps.com/
- **License/attribution:** ODbL Produced Work; attribute Protomaps © OpenStreetMap.
  Code BSD. — https://docs.protomaps.com/basemaps/downloads,
  https://docs.protomaps.com/basemaps/maplibre
- **Tuning:** Best-in-class for our use case conceptually: `@protomaps/basemaps`
  generates the whole layer stack from a `Flavor` — "a plain object of color
  definitions" — and ships **White / Grayscale / Black** dataviz flavors out of
  the box. A custom Flavor with only `#f3f2f2`/`#201e1d` gets the strict palette
  programmatically. — https://docs.protomaps.com/basemaps/flavors,
  https://docs.protomaps.com/basemaps/maplibre
- **Self-hosting effort:** Low but nonzero — download/extract, upload to bucket,
  set CORS, refresh the file occasionally for data updates. No tile server.
- **Caveat:** Protomaps schema ≠ OpenMapTiles schema, so its styles aren't
  interchangeable with OpenFreeMap/MapTiler/Stadia sources.

### MapTiler Cloud free tier

- **Cost/limits:** Free tier = 100k API requests + 5k sessions/month, 5 custom
  styles, **MapTiler logo on the map**, and it is "suitable for testing, personal
  or non-commercial use." First paid tier (Flex) is $30/month.
  — https://www.maptiler.com/cloud/pricing/
- **Verdict:** The non-commercial framing plus forced logo disqualify the free
  tier for a commercial MVP; $30/month buys nothing we can't get free above.
  (Their style editor is nice, but the output is standard OpenMapTiles-schema
  style JSON we can author ourselves.)

### Stadia Maps free tier

- **Cost/limits:** 200k credits/month, **commercial use not allowed** on free;
  Starter is $20/month. Static Maps API is not in the free tier (20 credits per
  static request on paid). — https://stadiamaps.com/pricing/
- **Styles:** Alidade Smooth is muted-but-not-grayscale; Stamen Toner is true
  black-and-white but a strong aesthetic of its own, not our palette.
  Attribution: Stadia © OpenMapTiles © OpenStreetMap.
  — https://docs.stadiamaps.com/map-styles/alidade-smooth/
- **Verdict:** Ruled out for MVP by the non-commercial free tier.

### Minimal custom style on the OpenMapTiles schema

Not a tile source but the styling strategy: the OpenMapTiles schema/cartography is
CC-BY (code BSD) and requires visible credit to "OpenMapTiles.org" — already part
of standard attribution. — https://github.com/openmaptiles/openmaptiles

A Trailhead style needs very few layers for a monochrome look: background +
`landcover`/`landuse` (all `#f3f2f2`), `water` (slightly darker gray or `#f3f2f2`
with `#201e1d` hairline), `boundary` (admin 0/2), optionally `transportation`
motorways and `place` country labels in `#201e1d`. Starting from Positron and
deleting/recoloring is a few hours' work, and the result runs against **any**
OpenMapTiles-schema source (OpenFreeMap now, self-hosted later).

### Attribution ground rules (applies to every option)

- Interactive maps: OSM credit "should typically appear in a corner of the map";
  it may be collapsible if license info stays reachable.
- **Static images (our landing teaser): attributed the same way as interactive
  maps** — credit legible near the image, linking to openstreetmap.org/copyright.
  (Exemptions only for <100 features / tiny areas — a world route map does not
  qualify.) — https://osmfoundation.org/wiki/Licence/Attribution_Guidelines

## 2. Great-circle arcs and the antimeridian

- **Standard tool:** `@turf/great-circle` — `greatCircle(start, end, {npoints,
  offset, properties})`, default 100 points. If start/end span the antimeridian
  "the resulting feature will be split into a MultiLineString"; `offset` "controls
  the likelyhood that lines will be split which cross the dateline."
  — https://turfjs.org/docs/api/greatCircle
- **Version pin:** turf issue #3030 — greatCircle antimeridian handling is
  **broken in 7.3.2+** (tested through 7.3.4; fix PR #3048 open as of writing).
  Pin `@turf/great-circle@7.3.1` and add a visual regression case for a
  Europe→Japan route. — https://github.com/turfjs/turf/issues/3030
- **Why splitting matters:** GeoJSON longitudes are ±180; a LineString jumping
  from +179 to −179 renders as a line dragged across the whole world. Two fixes:
  1. Render the MultiLineString split as-is (two segments meeting at the
     dateline edge — fine visually, simplest).
  2. **Unwrap longitudes** so the line continues past ±180 (e.g. 190 instead of
     −170): MapLibre's official "Display line that crosses 180th meridian"
     example does exactly this — when consecutive longitudes differ by ≥180,
     add/subtract 360 to keep the delta short. Gives one unbroken arc; needs
     `renderWorldCopies` (default true) so the neighboring world copy is drawn.
     — https://maplibre.org/maplibre-gl-js/docs/examples/display-line-that-crosses-180th-meridian/
- Europe→Japan (e.g. LHR–HND) does **not** cross the antimeridian — it arcs over
  Siberia — but it is the case that makes straight lines look badly wrong, so it
  still needs great-circle interpolation; transpacific routes (SFO–NRT, SYD–LAX)
  are the actual dateline cases to test.

## 3. Static export

### Landing teaser (pre-rendered, no live map)

- **Recommended: build-time screenshot.** Run the real dashboard style + red
  arcs in headless Chromium (Playwright) during CI/build, wait for MapLibre's
  `idle` event, capture the canvas/page at 2x `pixelRatio`, optimize to
  WebP/AVIF. Pixel-identical to the product, zero runtime tile traffic from the
  landing page, and attribution is baked in next to the image.
- **Headless alternative:** `@maplibre/maplibre-gl-native` Node bindings —
  actively maintained (not archived), purpose-built for "server-side map
  rendering and static map image generation"; Rust bindings are also under
  active development for the same purpose.
  — https://github.com/maplibre/maplibre-native (npm `@maplibre/maplibre-gl-native`)
- **Vendor static-map APIs** (MapTiler; Stadia paid-only, 20 credits/request)
  are ruled out: not on usable free tiers, and they can't easily reproduce our
  custom monochrome style + red arc overlays anyway.

### "Save as image" feature (in-app)

- **Mechanism:** WebGL clears the drawing buffer after compositing, so
  `canvas.toDataURL()` returns blank by default. Two standard patterns:
  1. Create the map with `canvasContextAttributes: { preserveDrawingBuffer:
     true }` (MapLibre `MapOptions`; default `false`, small persistent GPU cost),
     then `map.getCanvas().toDataURL('image/png')` any time.
     — https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/
  2. Leave it `false` and capture synchronously inside a `render`/`once('render')`
     callback after forcing a repaint — buffer is still intact at that moment.
- **Resolution:** canvas size = container × `pixelRatio`; for hi-res exports,
  render into a hidden container with a larger `pixelRatio` (respect
  `maxCanvasSize`, default 4096×4096 / GPU `MAX_TEXTURE_SIZE`).
  — https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/
- **Off-the-shelf:** `@watergis/maplibre-gl-export` adds an export control
  (PNG/PDF etc., forked from mapbox-gl-export) if we want page-size/DPI options
  without building UI. — https://github.com/watergis/maplibre-gl-export
- Note: because the red arcs and airport dots are ordinary MapLibre layers, both
  export paths capture them for free — no compositing step needed.

## Sources

- https://openfreemap.org/
- https://docs.protomaps.com/basemaps/flavors · /basemaps/maplibre · /basemaps/downloads · /pmtiles/
- https://protomaps.com/
- https://www.maptiler.com/cloud/pricing/
- https://stadiamaps.com/pricing/ · https://docs.stadiamaps.com/map-styles/alidade-smooth/
- https://github.com/openmaptiles/openmaptiles
- https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
- https://turfjs.org/docs/api/greatCircle · https://github.com/turfjs/turf/issues/3030
- https://maplibre.org/maplibre-gl-js/docs/examples/display-line-that-crosses-180th-meridian/
- https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/
- https://github.com/maplibre/maplibre-native
- https://github.com/watergis/maplibre-gl-export
