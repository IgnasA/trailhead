// M1 stub — frame 1c (the live import progress view) is an M2 slice.
// Proves the auth round-trip: shows the connected mailbox from the database.
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "../../lib/supabase/server";

export default async function ImportPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connect");

  const { data: connection } = await supabase
    .from("gmail_connections")
    .select("email_address, status, created_at")
    .eq("status", "connected")
    .maybeSingle();

  return (
    <main style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ padding: "14px 24px", borderBottom: "2px solid var(--color-text)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ font: "800 13px/1 var(--font-heading)" }}>TRAILHEAD</span>
        <span style={{ fontSize: 11 }} className="text-muted">Step 2 of 2</span>
      </div>
      <div style={{ padding: "30px 24px" }}>
        <h2>Connected.</h2>
        <div style={{ marginTop: 22, borderTop: "2px solid var(--color-text)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--color-divider)", fontSize: 13 }}>
            <span className="text-muted">Mailbox</span>
            <span style={{ fontWeight: 600 }}>{connection?.email_address ?? user.email}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--color-divider)", fontSize: 13 }}>
            <span className="text-muted">Access</span>
            <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>gmail.readonly</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--color-divider)", fontSize: 13 }}>
            <span className="text-muted">Token custody</span>
            <span style={{ fontWeight: 600 }}>Vault — server-side only</span>
          </div>
        </div>
        <p style={{ marginTop: 22, maxWidth: "34em" }} className="text-muted">
          The import itself ships next (M2): reading your mailbox with live
          per-stage progress, then the reveal. Nothing has been read yet.
        </p>
        <Link href="/" className="btn btn-secondary" style={{ marginTop: 8 }}>
          Back to the landing
        </Link>
      </div>
    </main>
  );
}
