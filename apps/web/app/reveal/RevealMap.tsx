"use client";

// The reveal's map stop: the same monochrome basemap and great-circle routes
// as the dashboard, but the routes draw in when the stop enters view.
import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import greatCircle from "@turf/great-circle";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import { monochromeStyle } from "../../lib/map/monochromeStyle";
import type { Airport, Route } from "../dashboard/map/RouteMap";
import "maplibre-gl/dist/maplibre-gl.css";

const empty: FeatureCollection<LineString> = { type: "FeatureCollection", features: [] };

export function RevealMap({
  airports, routes, play,
}: {
  airports: Airport[]; routes: Route[]; play: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const arcs = useRef<Feature<LineString>[]>([]);
  const started = useRef(false);

  useEffect(() => {
    if (!container.current || map.current) return;
    maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    const byCode = new Map(airports.map((a) => [a.iata, a]));

    arcs.current = routes.flatMap((r) => {
      const a = byCode.get(r.origin);
      const b = byCode.get(r.dest);
      if (!a || !b) return [];
      const g = greatCircle([a.lon, a.lat], [b.lon, b.lat], { npoints: 64 }).geometry;
      const parts = g.type === "LineString" ? [g.coordinates] : g.coordinates;
      return parts.map<Feature<LineString>>((coordinates) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates },
      }));
    });

    const dots: FeatureCollection<Point> = {
      type: "FeatureCollection",
      features: airports.map((a) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [a.lon, a.lat] },
      })),
    };

    const m = new maplibregl.Map({
      container: container.current,
      style: monochromeStyle,
      center: [10, 30],
      zoom: 1.1,
      interactive: false, // it's a closing image, not a tool
      attributionControl: { compact: true },
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    map.current = m;

    m.on("load", () => {
      m.addSource("routes", { type: "geojson", data: empty });
      m.addSource("airports", { type: "geojson", data: dots });
      m.addLayer({
        id: "routes", type: "line", source: "routes",
        layout: { "line-cap": "round" },
        paint: { "line-color": "#ec3013", "line-opacity": 0.6, "line-width": 1.4 },
      });
      m.addLayer({
        id: "airports", type: "circle", source: "airports",
        paint: {
          "circle-color": "#201e1d", "circle-radius": 2.6,
          "circle-stroke-color": "#f3f2f2", "circle-stroke-width": 1,
        },
      });
      const bounds = new maplibregl.LngLatBounds();
      for (const f of dots.features) bounds.extend(f.geometry.coordinates as [number, number]);
      if (dots.features.length) m.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 4.5 });
    });

    return () => {
      m.remove();
      map.current = null;
    };
  }, [airports, routes]);

  // Routes draw in on entry, one after another.
  useEffect(() => {
    const m = map.current;
    if (!play || !m || started.current) return;
    started.current = true;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = () => {
      const source = m.getSource("routes") as GeoJSONSource | undefined;
      if (!source) return;
      if (reduce) {
        source.setData({ type: "FeatureCollection", features: arcs.current });
        return;
      }
      const total = arcs.current.length;
      const start = performance.now();
      const duration = 1800;
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const shown = Math.ceil(p * total);
        source.setData({ type: "FeatureCollection", features: arcs.current.slice(0, shown) });
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    if (m.isStyleLoaded() && m.getSource("routes")) draw();
    else m.once("idle", draw);
  }, [play]);

  return <div ref={container} style={{ width: "100%", height: "100%" }} />;
}
