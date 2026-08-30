import { Block } from "../Skeleton";

export default function FlightsLoading() {
  return (
    <div style={{ padding: "20px 24px" }} aria-busy="true" aria-label="Loading flights">
      <div style={{ display: "flex", gap: 24, padding: "10px 8px", borderBottom: "2px solid var(--color-divider)" }}>
        {[60, 40, 50, 60, 70].map((w, i) => <Block key={i} w={w} h={8} />)}
      </div>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 24, alignItems: "center", padding: "12px 8px", borderBottom: "1px solid var(--color-divider)" }}>
          <Block w={92} h={11} /><Block w={72} h={9} /><Block w={58} h={9} />
          <span style={{ flex: 1 }} /><Block w={64} h={9} />
        </div>
      ))}
    </div>
  );
}
