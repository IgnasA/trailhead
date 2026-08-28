"use client";

// Frame 1f — MapLibre with great-circle routes and airport dots sized by
// activity. Monochrome basemap so the red data is the only colour.
import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, MapLayerMouseEvent } from "maplibre-gl";
import greatCircle from "@turf/great-circle";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import { monochromeStyle } from "../../../lib/map/monochromeStyle";
import "maplibre-gl/dist/maplibre-gl.css";

export interface Airport {
  iata: string;
  name: string;
  lat: number;
  lon: number;
}
export interface Route {
  origin: string;
  dest: string;
  count: number;
}

function buildRoutes(routes: Route[], airports: Map<string, Airport>): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = [];
  for (const r of routes) {
    const a = airports.get(r.origin);
    const b = airports.get(r.dest);
    if (!a || !b) continue;
    // Great-circle, not a straight line: a flight to Tokyo arcs over Siberia.
    // turf 7.3.1 is pinned — 7.3.2+ has an open antimeridian regression.
    const arc = greatCircle([a.lon, a.lat], [b.lon, b.lat], { npoints: 64 });
    const geometry = arc.geometry;
    if (geometry.type === "LineString") {
      features.push({ type: "Feature", properties: { count: r.count }, geometry });
    } else {
      // A dateline crossing comes back split — render both halves.
      for (const coordinates of geometry.coordinates) {
        features.push({
          type: "Feature",
          properties: { count: r.count },
          geometry: { type: "LineString", coordinates },
        });
      }
    }
  }
  return { type: "FeatureCollection", features };
}

function buildAirports(
  activity: Map<string, number>,
  airports: Map<string, Airport>,
): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const [iata, count] of activity) {
    const a = airports.get(iata);
    if (!a) continue;
    features.push({
      type: "Feature",
      properties: { iata, count, name: a.name },
      geometry: { type: "Point", coordinates: [a.lon, a.lat] },
    });
  }
  return { type: "FeatureCollection", features };
}

export function RouteMap({ airports, routes }: { airports: Airport[]; routes: Route[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!container.current || map.current) return;
    const byCode = new Map(airports.map((a) => [a.iata, a]));
    const activity = new Map<string, number>();
    for (const r of routes) {
      activity.set(r.origin, (activity.get(r.origin) ?? 0) + r.count);
      activity.set(r.dest, (activity.get(r.dest) ?? 0) + r.count);
    }
    const routeData = buildRoutes(routes, byCode);
    const airportData = buildAirports(activity, byCode);

    // See scripts/copy-maplibre-worker.mjs for why the worker is self-hosted.
    maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

    const m = new maplibregl.Map({
      container: container.current,
      style: monochromeStyle,
      center: [10, 30],
      zoom: 1.2,
      attributionControl: { compact: true },
      // Needed for "save as image" later (basemap ticket) — set at creation.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    m.on("load", () => {
      m.addSource("routes", { type: "geojson", data: routeData });
      m.addSource("airports", { type: "geojson", data: airportData });
      m.addLayer({
        id: "routes",
        type: "line",
        source: "routes",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": "#ec3013",
          "line-opacity": 0.55,
          "line-width": ["interpolate", ["linear"], ["get", "count"], 1, 1, 6, 2.6],
        },
      });
      m.addLayer({
        id: "airports",
        type: "circle",
        source: "airports",
        paint: {
          "circle-color": "#201e1d",
          "circle-radius": ["interpolate", ["linear"], ["get", "count"], 1, 2.5, 20, 7],
          "circle-stroke-color": "#f3f2f2",
          "circle-stroke-width": 1,
        },
      });

      const popup = new maplibregl.Popup({ closeButton: false, offset: 8 });
      m.on("mouseenter", "airports", (e: MapLayerMouseEvent) => {
        m.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        const { iata, name, count } = f.properties as { iata: string; name: string; count: number };
        popup
          .setLngLat((f.geometry as Point).coordinates as [number, number])
          .setHTML(
            `<div style="font:600 11px/1.4 Archivo,sans-serif"><strong>${iata}</strong> · ${count} flight${count === 1 ? "" : "s"}<br><span style="opacity:.6">${name}</span></div>`,
          )
          .addTo(m);
      });
      m.on("mouseleave", "airports", () => {
        m.getCanvas().style.cursor = "";
        popup.remove();
      });

      // Frame the actual history rather than the whole globe.
      const bounds = new maplibregl.LngLatBounds();
      let any = false;
      for (const f of airportData.features) {
        bounds.extend(f.geometry.coordinates as [number, number]);
        any = true;
      }
      if (any) m.fitBounds(bounds, { padding: 48, duration: 0, maxZoom: 5 });
    });

    return () => {
      m.remove();
      map.current = null;
    };
  }, [airports, routes]);

  // Re-render layers when the filter changes without rebuilding the map.
  useEffect(() => {
    const m = map.current;
    if (!m || !m.isStyleLoaded()) return;
    const byCode = new Map(airports.map((a) => [a.iata, a]));
    const activity = new Map<string, number>();
    for (const r of routes) {
      activity.set(r.origin, (activity.get(r.origin) ?? 0) + r.count);
      activity.set(r.dest, (activity.get(r.dest) ?? 0) + r.count);
    }
    (m.getSource("routes") as GeoJSONSource | undefined)?.setData(buildRoutes(routes, byCode));
    (m.getSource("airports") as GeoJSONSource | undefined)?.setData(buildAirports(activity, byCode));
  }, [airports, routes]);

  return <div ref={container} style={{ width: "100%", height: "100%", minHeight: 430 }} />;
}
