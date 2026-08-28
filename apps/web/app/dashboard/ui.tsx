// Small shared pieces for the dashboard views (Modernist: rules and grid do
// the work — no cards, no shadows).
import Link from "next/link";

export function KpiCell({
  value, label, compact = false, last = false,
}: {
  value: number; label: string; compact?: boolean; last?: boolean;
}) {
  const shown =
    compact && value >= 1000 ? `${Math.round(value / 1000).toLocaleString()}k` : value.toLocaleString();
  return (
    <div style={{ padding: "22px 18px", borderRight: last ? "none" : "1px solid var(--color-divider)" }}>
      <div style={{ font: "800 40px/1 var(--font-heading)", letterSpacing: "-.03em" }} className="kpi-value">
        {shown}
      </div>
      <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginTop: 9 }}>{label}</h6>
    </div>
  );
}

/** The review queue is a first-class part of the product, not an error state:
 *  clustering declined to guess and is saying so (trip ticket). */
export function ReviewNotice({ count }: { count: number }) {
  if (!count) return null;
  return (
    <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--color-divider)", display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
      <span style={{ font: "700 9.5px/1 var(--font-body)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-accent)", border: "1px solid var(--color-accent)", padding: "4px 8px" }}>
        Needs review
      </span>
      <span style={{ fontSize: 12.5 }} className="text-muted">
        {count.toLocaleString()} flight{count === 1 ? "" : "s"} we couldn&rsquo;t confidently place in a trip — we didn&rsquo;t guess.
      </span>
      <Link href="/dashboard/trips" className="btn btn-ghost" style={{ fontSize: 12 }}>
        Review them →
      </Link>
    </div>
  );
}

export const formatRoute = (a: string, b: string) => `${a} → ${b}`;

export function formatLocal(local: string | null, tz: string | null): string | null {
  if (!local) return null;
  // Wall time is stored verbatim; render it as written, with the airport's
  // zone as the label (reference-data ticket: Intl renders, we never convert).
  const time = local.slice(11, 16);
  if (!time) return null;
  if (!tz) return time;
  const abbrev = new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "short" })
    .formatToParts(new Date(`${local.slice(0, 10)}T12:00:00Z`))
    .find((p) => p.type === "timeZoneName")?.value;
  return abbrev ? `${time} ${abbrev}` : time;
}
