"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Section links keep the year filter — it is global state (schema ticket). */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = pathname === href;
  const qs = params.toString();
  return (
    <Link
      href={qs ? `${href}?${qs}` : href}
      style={{
        font: "600 12px/1 var(--font-body)",
        color: active ? "var(--color-text)" : "color-mix(in srgb, var(--color-text) 55%, transparent)",
        textDecoration: "none",
        borderBottom: active ? "2px solid var(--color-accent)" : "2px solid transparent",
        paddingBottom: 3,
      }}
    >
      {children}
    </Link>
  );
}
