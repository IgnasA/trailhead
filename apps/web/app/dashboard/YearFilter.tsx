"use client";

// The year filter is one piece of state in the URL (schema ticket: "a URL
// param, not a store"), so it drives KPIs, bars, trips and the map alike,
// and every view is linkable.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function YearFilter({ years }: { years: number[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("year");

  const href = (year: number | null) => {
    const next = new URLSearchParams(params.toString());
    if (year === null) next.delete("year");
    else next.set("year", String(year));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const cell = (selected: boolean, first: boolean) => ({
    padding: "8px 11px",
    font: "600 11px/1 var(--font-body)",
    textDecoration: "none",
    color: selected ? "var(--color-bg)" : "var(--color-text)",
    background: selected ? "var(--color-accent)" : "transparent",
    borderLeft: first ? "none" : "1px solid var(--color-divider)",
  });

  return (
    <div style={{ display: "flex", border: "1px solid var(--color-divider)" }}>
      <Link href={href(null)} style={cell(!active, true)}>All</Link>
      {years.map((y, i) => (
        <Link key={y} href={href(y)} style={cell(active === String(y), i === -1)}>
          {y}
        </Link>
      ))}
    </div>
  );
}
