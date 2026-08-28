// A minimal monochrome basemap on the OpenMapTiles schema, served by
// OpenFreeMap (basemap ticket: free, no key, no request limits, commercial
// use fine — the only obligation is the attribution below).
//
// Deliberately about eight layer groups, not a full cartographic style: the
// design system says the data is the only colour on screen, so the map is
// ink on ground and the red routes sit on top of it.
import type { StyleSpecification } from "maplibre-gl";

// OpenMapTiles has no global land polygon: the background IS the land and
// water is drawn on top of it, the way Positron does it.
const LAND = "#f3f2f2";
const WATER = "#e3e0df";
const LINE = "#cdc9c8";
const INK = "#201e1d";

export const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a>, data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

export const monochromeStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    openmaptiles: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution: ATTRIBUTION,
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": LAND } },
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      paint: { "fill-color": WATER },
    },
    {
      id: "boundary-country",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      filter: ["<=", ["get", "admin_level"], 2],
      paint: { "line-color": LINE, "line-width": 0.8 },
    },
    {
      id: "place-country",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      filter: ["==", ["get", "class"], "country"],
      minzoom: 2,
      layout: {
        "text-field": ["get", "name:latin"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 10,
        "text-letter-spacing": 0.12,
        "text-transform": "uppercase",
      },
      paint: {
        "text-color": INK,
        "text-opacity": 0.45,
        "text-halo-color": LAND,
        "text-halo-width": 1.2,
      },
    },
  ],
};
