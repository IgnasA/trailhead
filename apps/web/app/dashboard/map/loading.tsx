import { Block } from "../Skeleton";

export default function MapLoading() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr" }} className="split" aria-busy="true" aria-label="Loading map">
      <aside style={{ padding: 20, borderRight: "2px solid var(--color-text)" }}>
        <Block w={60} h={8} />
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 6 }, (_, i) => <Block key={i} w={`${50 + ((i * 11) % 40)}%`} h={9} />)}
        </div>
      </aside>
      <div>
        <div style={{ height: 460, background: "var(--color-neutral-200)" }} />
        <div style={{ borderTop: "2px solid var(--color-text)", padding: "14px 20px", display: "flex", gap: 34 }}>
          {[0, 1, 2].map((i) => (
            <div key={i}><Block w={38} h={17} /><div style={{ marginTop: 7 }}><Block w={80} h={8} /></div></div>
          ))}
        </div>
      </div>
    </div>
  );
}
