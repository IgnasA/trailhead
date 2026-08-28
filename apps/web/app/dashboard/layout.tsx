// Frame 1e/1f/1g share this chrome: brand, section nav, global year filter.
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "../../lib/supabase/server";
import { YearFilter } from "./YearFilter";
import { NavLink } from "./NavLink";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connect");

  const { data: years } = await supabase.rpc("flights_per_year");
  const yearList: number[] = (years ?? [])
    .map((r: { year: number }) => r.year)
    .sort((a: number, b: number) => b - a)
    .slice(0, 4);

  return (
    <main>
      <nav
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, padding: "14px 24px", borderBottom: "2px solid var(--color-text)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 26, flexWrap: "wrap" }}>
          <Link href="/dashboard" style={{ font: "800 14px/1 var(--font-heading)", color: "inherit", textDecoration: "none" }}>
            TRAILHEAD
          </Link>
          <div style={{ display: "flex", gap: 20 }}>
            <NavLink href="/dashboard">Overview</NavLink>
            <NavLink href="/dashboard/trips">Trips</NavLink>
            <NavLink href="/dashboard/flights">Flights</NavLink>
            <NavLink href="/dashboard/map">Map</NavLink>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Suspense fallback={null}>
            <YearFilter years={yearList} />
          </Suspense>
          <Link href="/settings" style={{ font: "600 12px/1 var(--font-body)", color: "color-mix(in srgb, var(--color-text) 55%, transparent)", textDecoration: "none" }}>
            Settings
          </Link>
        </div>
      </nav>
      {children}
    </main>
  );
}
