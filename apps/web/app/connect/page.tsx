// Frame 1b — our trust screen, shown BEFORE Google's consent dialog.
// The lists come from packages/domain/src/privacy.ts, the same source the
// privacy page and docs/privacy.md render from, because the privacy ticket
// requires this screen to match them word for word. They were hardcoded here
// until adding manual flights changed "we store" and this screen alone kept
// the old text — which is exactly the drift that rule exists to prevent.
import Link from "next/link";
import { WE_NEVER_STORE, WE_STORE } from "@trailhead/domain";
import { ConnectButton } from "./ConnectButton";

const ERRORS: Record<string, string> = {
  missing_code: "Google didn't return a sign-in code. Please try again.",
  exchange_failed: "Sign-in couldn't be completed. Please try again.",
  no_refresh_token:
    "Google didn't grant offline access, which the import needs. Try again and approve the Gmail permission.",
  store_failed: "We couldn't save your connection securely. Nothing was imported. Please try again.",
};

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ padding: "14px 24px", borderBottom: "2px solid var(--color-text)", font: "800 13px/1 var(--font-heading)" }}>
        <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>TRAILHEAD</Link>
      </div>
      <div style={{ padding: "32px 24px 28px" }}>
        <h6 style={{ color: "color-mix(in srgb, var(--color-text) 50%, transparent)", marginBottom: 14 }}>
          Step 1 of 2
        </h6>
        <h2 style={{ maxWidth: "14em" }}>Trailhead reads flight emails. Nothing else.</h2>

        {error && (
          <p style={{ marginTop: 16, padding: "12px 14px", borderLeft: "2px solid var(--color-accent)", background: "var(--color-accent-100)", fontSize: 13 }}>
            {ERRORS[error] ?? "Something went wrong. Please try again."}
          </p>
        )}

        <div style={{ marginTop: 26, borderTop: "2px solid var(--color-text)", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          <div style={{ padding: "16px 16px 16px 0", borderRight: "1px solid var(--color-divider)" }}>
            <h6 style={{ color: "var(--color-accent)", marginBottom: 12 }}>We store</h6>
            {WE_STORE.map((t) => (
              <div key={t} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, background: "var(--color-text)", flex: "none" }} />
                <span style={{ font: "500 12px/1.3 var(--font-body)" }}>{t}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "16px 0 16px 16px" }}>
            <h6 style={{ color: "color-mix(in srgb, var(--color-text) 50%, transparent)", marginBottom: 12 }}>
              We never store
            </h6>
            {WE_NEVER_STORE.map((t) => (
              <div key={t} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, border: "1.5px solid var(--color-neutral-500)", flex: "none" }} />
                <span style={{ font: "500 12px/1.3 var(--font-body)", color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "2px solid var(--color-text)", padding: "16px 0" }}>
          <p style={{ font: "600 11px/1.5 var(--font-body)", color: "color-mix(in srgb, var(--color-text) 70%, transparent)", marginBottom: 10 }}>
            Scope requested:{" "}
            <code style={{ fontFamily: "ui-monospace, Menlo, monospace", background: "var(--color-neutral-200)", padding: "2px 5px" }}>
              gmail.readonly
            </code>
          </p>
          <p style={{ fontSize: 13, maxWidth: "38em", margin: 0 }} className="text-muted">
            That is Google&rsquo;s read-only Gmail permission: Trailhead can search and read
            messages to find flights, and can never send, modify, or delete anything.
            Email bodies are fetched only while you look at them and are never kept.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, borderTop: "2px solid var(--color-text)", paddingTop: 18 }}>
          <ConnectButton />
          <span style={{ font: "500 12px/1 var(--font-body)", color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
            Disconnect any time
          </span>
        </div>
      </div>
    </main>
  );
}
