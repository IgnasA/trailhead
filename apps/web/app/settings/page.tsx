// Settings: what we hold, and the separate ways to be rid of it. The copy is
// the same source the permission screen and docs/privacy.md render from.
import Link from "next/link";
import { redirect } from "next/navigation";
import { PRIVACY_ACTIONS, WE_NEVER_STORE, WE_STORE, GMAIL_SCOPE } from "@trailhead/domain";
import { supabaseServer } from "../../lib/supabase/server";
import { DangerAction } from "./DangerAction";

export default async function Settings() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connect");

  const [{ data: connection }, flights, emails, trips] = await Promise.all([
    supabase.from("gmail_connections").select("email_address, status").maybeSingle(),
    supabase.from("flights").select("id", { count: "exact", head: true }),
    supabase.from("source_emails").select("id", { count: "exact", head: true }),
    supabase.from("trips").select("id", { count: "exact", head: true }),
  ]);
  const connected = connection?.status === "connected";

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 80px" }}>
      <div style={{ padding: "14px 0", borderBottom: "2px solid var(--color-text)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Link href="/dashboard" style={{ font: "800 13px/1 var(--font-heading)", color: "inherit", textDecoration: "none" }}>
          TRAILHEAD
        </Link>
        <Link href="/privacy" className="btn btn-ghost" style={{ fontSize: 12 }}>Privacy →</Link>
      </div>

      <h2 style={{ marginTop: 30 }}>Settings</h2>

      <section style={{ marginTop: 24 }}>
        <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 12 }}>
          What we hold for you
        </h6>
        <div style={{ borderTop: "2px solid var(--color-text)" }}>
          {[
            ["Mailbox", connection?.email_address ?? "—"],
            ["Access", connected ? `Connected · ${GMAIL_SCOPE}` : "Disconnected"],
            ["Flights", (flights.count ?? 0).toLocaleString()],
            ["Trips", (trips.count ?? 0).toLocaleString()],
            ["Source email records", (emails.count ?? 0).toLocaleString()],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--color-divider)", fontSize: 13 }}>
              <span className="text-muted">{label}</span>
              <span style={{ fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 20 }} className="split">
          <div>
            <h6 style={{ color: "var(--color-accent)", marginBottom: 10 }}>We store</h6>
            {WE_STORE.map((t) => (
              <div key={t} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 9 }}>
                <span style={{ width: 8, height: 8, background: "var(--color-text)", flex: "none" }} />
                <span style={{ font: "500 12px/1.3 var(--font-body)" }}>{t}</span>
              </div>
            ))}
          </div>
          <div>
            <h6 style={{ color: "color-mix(in srgb, var(--color-text) 50%, transparent)", marginBottom: 10 }}>
              We never store
            </h6>
            {WE_NEVER_STORE.map((t) => (
              <div key={t} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 9 }}>
                <span style={{ width: 8, height: 8, border: "1.5px solid var(--color-neutral-500)", flex: "none" }} />
                <span style={{ font: "500 12px/1.3 var(--font-body)" }} className="text-muted">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 4 }}>
          Your data
        </h6>
        <p style={{ fontSize: 13, maxWidth: "44em", marginBottom: 6 }} className="text-muted">
          These are separate on purpose. Your travel history outlives the emails
          it was built from, so forgetting the emails and forgetting the history
          are different requests.
        </p>
        <div style={{ borderTop: "2px solid var(--color-text)" }}>
          {PRIVACY_ACTIONS.map((action) => (
            <DangerAction
              key={action.id}
              action={action}
              disabled={action.id === "disconnect" && !connected}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
