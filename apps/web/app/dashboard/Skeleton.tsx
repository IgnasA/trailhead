// Loading placeholders drawn in the design system's own terms: rules and grey
// blocks. Deliberately no shimmer — the system is flat and unanimated, and a
// pulsing gradient would read as a different product.
export function Block({ w, h = 12, style }: { w: number | string; h?: number; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        display: "block",
        width: typeof w === "number" ? `${w}px` : w,
        height: h,
        background: "var(--color-neutral-300)",
        ...style,
      }}
    />
  );
}

export function SkeletonRows({ count, height = 56 }: { count: number; height?: number }) {
  return (
    <div style={{ borderTop: "2px solid var(--color-text)" }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ padding: "16px 0", borderBottom: "1px solid var(--color-divider)", height }}>
          <Block w={`${38 + ((i * 13) % 30)}%`} h={13} />
          <div style={{ marginTop: 10 }}><Block w={`${22 + ((i * 7) % 20)}%`} h={8} /></div>
        </div>
      ))}
    </div>
  );
}
