"use client";

// PROTOTYPE chrome — deliberately unstyled like the product, so it is obvious
// it is not part of the design being judged. Never rendered in production.
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function PrototypeSwitcher({ variants, names }: { variants: string[]; names: Record<string, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("variant") ?? variants[0]!;
  const i = Math.max(0, variants.indexOf(current));

  const go = (delta: number) => {
    const next = variants[(i + delta + variants.length) % variants.length]!;
    const p = new URLSearchParams(params.toString());
    p.set("variant", next);
    router.replace(`${pathname}?${p.toString()}`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ||
          (el as HTMLElement | null)?.isContentEditable) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div style={{
      position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 100,
      display: "flex", alignItems: "center", gap: 4, padding: 4,
      background: "#111", color: "#fff", borderRadius: 999,
      boxShadow: "0 6px 24px rgba(0,0,0,.35)", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12,
    }}>
      <button onClick={() => go(-1)} style={btn}>←</button>
      <span style={{ padding: "0 10px", whiteSpace: "nowrap" }}>
        {current} · {names[current] ?? ""}
      </span>
      <button onClick={() => go(1)} style={btn}>→</button>
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "#333", color: "#fff", border: "none", borderRadius: 999,
  width: 28, height: 28, cursor: "pointer", fontSize: 13,
};
