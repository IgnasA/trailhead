"use client";

// Counts to a new value when the year filter changes — but never on first
// paint. Watching numbers spool up on every single visit is a gimmick; seeing
// them move when you change the filter is feedback.
import { useEffect, useRef, useState } from "react";

export function AnimatedNumber({
  value, compact = false, duration = 500,
}: {
  value: number;
  /** Render thousands as "244k" — the KPI row's kilometre cell. */
  compact?: boolean;
  duration?: number;
}) {
  // Formatting lives here rather than arriving as a prop: functions can't
  // cross the server/client boundary.
  const format = (n: number) =>
    compact && n >= 1000 ? `${Math.round(n / 1000).toLocaleString()}k` : n.toLocaleString();
  const [shown, setShown] = useState(value);
  const previous = useRef(value);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      previous.current = value;
      setShown(value);
      return;
    }
    const from = previous.current;
    previous.current = value;
    if (from === value) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{format(shown)}</>;
}
