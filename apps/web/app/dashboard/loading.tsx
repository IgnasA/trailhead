// Streamed instantly while a dashboard page fetches, so navigation shows the
// shape of what's coming instead of the previous page frozen. Built from the
// design system's own vocabulary — rules and grey blocks, no shimmer.
import { Block } from "./Skeleton";

export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", borderBottom: "2px solid var(--color-text)" }} className="kpi-row">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ padding: "22px 18px", borderRight: i < 4 ? "1px solid var(--color-divider)" : "none" }}>
            <Block w={i === 3 ? 96 : 64} h={38} />
            <div style={{ marginTop: 12 }}><Block w={70} h={8} /></div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr" }} className="split">
        <div style={{ padding: "22px 24px", borderRight: "2px solid var(--color-text)" }}>
          <Block w={110} h={8} />
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 120, marginTop: 22, borderBottom: "2px solid var(--color-text)" }}>
            {[34, 12, 20, 56, 74, 44, 100, 62, 30, 48, 26].map((h, i) => (
              <span key={i} style={{ flex: 1, height: `${h}%`, background: "var(--color-neutral-300)" }} />
            ))}
          </div>
        </div>
        <div style={{ padding: "22px 24px" }}>
          <Block w={90} h={8} />
          <div style={{ borderTop: "1px solid var(--color-divider)", marginTop: 16 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <Block w={86} h={10} />
                <Block w={48} h={8} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
