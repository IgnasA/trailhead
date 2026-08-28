"use client";

// Frame 1d/1i — the magic moment, in the "free flow" choreography chosen from
// the prototype (tracker ticket 012): one continuous scroll, each stop
// revealing and counting up once as it enters. No scroll-snap, no hijack.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RevealMap } from "./RevealMap";
import { SaveImage } from "./SaveImage";
import type { Airport, Route } from "../dashboard/map/RouteMap";

export interface RevealStats {
  flights: number;
  countries: number;
  airports: number;
  km: number;
  airlines: number;
  air_seconds: number;
  air_measured_share: number;
  first_date: string | null;
  last_date: string | null;
  most_visited: { country: string; visits: number } | null;
  top_airline: { code: string; flights: number } | null;
  longest: { origin: string; dest: string; km: number } | null;
  busiest_year: { year: number; flights: number } | null;
}

const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

/** Reveal once on entry, then stay — the free-flow rule. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, shown };
}

function CountUp({ target, shown, duration = 1400 }: { target: number; shown: boolean; duration?: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!shown) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, target, duration]);
  return <>{value.toLocaleString()}</>;
}

const revealStyle = (shown: boolean) => ({
  opacity: shown ? 1 : 0,
  transform: shown ? "none" : "translateY(26px)",
  transition: "opacity .7s ease, transform .7s cubic-bezier(.2,.8,.2,1)",
});

export function Reveal({
  stats, airports, routes,
}: {
  stats: RevealStats; airports: Airport[]; routes: Route[];
}) {
  const hook = useReveal<HTMLElement>();
  const stack = useReveal<HTMLElement>();
  const map = useReveal<HTMLElement>();

  const days = Math.floor(stats.air_seconds / 86400);
  const hours = Math.round((stats.air_seconds % 86400) / 3600);
  const years = [stats.first_date?.slice(0, 4), stats.last_date?.slice(0, 4)].filter(Boolean);
  const estimated = stats.air_measured_share < 100;

  const rows: [string, number, boolean][] = [
    ["Countries", stats.countries, false],
    ["Airports", stats.airports, false],
    ["Kilometres", stats.km, true],
    ["Airlines", stats.airlines, false],
  ];

  const supers = [
    stats.most_visited && ["Most visited", countryName(stats.most_visited.country), `${stats.most_visited.visits} flights there`],
    stats.top_airline && ["Most used airline", stats.top_airline.code, `${stats.top_airline.flights} flights`],
    stats.longest && ["Longest flight", `${stats.longest.origin} → ${stats.longest.dest}`, `${stats.longest.km.toLocaleString()} km`],
    stats.busiest_year && ["Busiest year", String(stats.busiest_year.year), `${stats.busiest_year.flights} flights`],
  ].filter(Boolean) as [string, string, string][];

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "0 28px" }}>
      {/* Stop 1 — the hook */}
      <section
        ref={hook.ref}
        style={{ ...revealStyle(hook.shown), padding: "16vh 0 18vh", borderBottom: "2px dashed var(--color-divider)" }}
      >
        <h6 style={{ color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>Your travel history</h6>
        {years.length === 2 && (
          <div style={{ font: "600 13px/1 var(--font-body)", letterSpacing: ".2em", color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginTop: 34 }}>
            {years[0]} &nbsp;→&nbsp; {years[1]}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginTop: 6, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800, fontSize: "clamp(88px, 16vw, 132px)", lineHeight: 0.86, letterSpacing: "-.045em" }}>
            <CountUp target={stats.flights} shown={hook.shown} />
          </div>
          <div style={{ font: "700 26px/1 var(--font-heading)", paddingBottom: 14 }}>flights</div>
        </div>
        <p style={{ fontSize: 15, maxWidth: "26em", marginTop: 18 }} className="text-muted">
          You&rsquo;ve been in the air for {estimated ? "about " : ""}
          <strong style={{ color: "var(--color-text)" }}>{days} days, {hours} hours</strong>.
        </p>
        <div style={{ font: "600 11px/1 var(--font-body)", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--color-accent)", marginTop: 30 }}>
          Scroll ↓
        </div>
      </section>

      {/* Stop 2 — the stack */}
      <section ref={stack.ref} style={{ ...revealStyle(stack.shown), padding: "12vh 0 14vh", borderBottom: "2px dashed var(--color-divider)" }}>
        <h6 style={{ color: "color-mix(in srgb, var(--color-text) 50%, transparent)", marginBottom: 24 }}>The numbers</h6>
        <div style={{ borderTop: "2px solid var(--color-text)" }}>
          {rows.map(([label, value, accent], i) => (
            <div
              key={label}
              style={{
                display: "flex", alignItems: "baseline", justifyContent: "space-between",
                padding: "14px 0",
                borderBottom: i === rows.length - 1 ? "2px solid var(--color-text)" : "1px solid var(--color-divider)",
                opacity: stack.shown ? 1 : 0,
                transform: stack.shown ? "none" : "translateY(18px)",
                transition: `opacity .5s ${i * 0.12}s, transform .5s ${i * 0.12}s cubic-bezier(.2,.8,.2,1)`,
              }}
            >
              <div style={{ font: "700 15px/1 var(--font-heading)", letterSpacing: ".06em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                {label}
              </div>
              <div style={{ fontWeight: 800, fontSize: "clamp(28px,6vw,44px)", lineHeight: 1, letterSpacing: "-.03em", color: accent ? "var(--color-accent)" : "inherit", fontVariantNumeric: "tabular-nums" }}>
                <CountUp target={value} shown={stack.shown} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(4, supers.length)}, 1fr)`, marginTop: 26, borderTop: "1px solid var(--color-divider)" }} className="supers">
          {supers.map(([label, big, small], i) => (
            <div key={label} style={{ padding: i === 0 ? "14px 12px 0 0" : "14px 12px 0 12px", borderRight: i < supers.length - 1 ? "1px solid var(--color-divider)" : "none" }}>
              <h6 style={{ color: "color-mix(in srgb, var(--color-text) 50%, transparent)", fontSize: 9.5 }}>{label}</h6>
              <div style={{ font: "700 16px/1.2 var(--font-heading)", marginTop: 7 }}>{big}</div>
              <div style={{ font: "400 11px/1 var(--font-body)", marginTop: 4 }} className="text-muted">{small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Stop 3 — the map lands */}
      <section ref={map.ref} style={{ ...revealStyle(map.shown), padding: "12vh 0 14vh" }}>
        <h6 style={{ color: "color-mix(in srgb, var(--color-text) 50%, transparent)", marginBottom: 18 }}>
          Everywhere, at once
        </h6>
        <div style={{ height: 360, border: "1px solid var(--color-divider)" }}>
          <RevealMap airports={airports} routes={routes} play={map.shown} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 22, borderTop: "2px solid var(--color-text)", paddingTop: 20, flexWrap: "wrap" }}>
          <Link href="/dashboard" className="btn btn-primary">Open my dashboard</Link>
          <SaveImage stats={stats} />
        </div>
        {estimated && (
          <p style={{ fontSize: 11, marginTop: 18 }} className="text-muted">
            Time in the air is measured where your emails stated both times
            ({stats.air_measured_share}% of flights) and estimated from distance for the rest.
          </p>
        )}
      </section>
    </main>
  );
}
