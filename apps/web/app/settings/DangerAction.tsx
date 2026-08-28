"use client";

// Each privacy action states its consequence before it runs, and the
// destructive ones require the words to be typed — these are irreversible
// and quietly different from each other.
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PrivacyAction } from "@trailhead/domain";
import { supabaseBrowser } from "../../lib/supabase/client";

const RPC: Record<PrivacyAction["id"], string> = {
  disconnect: "disconnect_gmail",
  delete_emails: "delete_source_emails",
  delete_history: "delete_history",
  delete_account: "delete_account",
};

export function DangerAction({ action, disabled }: { action: PrivacyAction; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const ready = !action.destructive || typed.trim().toUpperCase() === action.confirm.toUpperCase();

  async function run() {
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();

    // Disconnect also revokes at Google, which needs the server.
    if (action.id === "disconnect") {
      const res = await fetch("/api/disconnect", { method: "POST" });
      if (!res.ok) {
        setError("Couldn't disconnect. Please try again.");
        setBusy(false);
        return;
      }
    } else {
      const { error } = await supabase.rpc(RPC[action.id]);
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
    }

    if (action.id === "delete_account") {
      await supabase.auth.signOut();
      window.location.href = "/";
      return;
    }
    setResult("Done.");
    setOpen(false);
    setTyped("");
    setBusy(false);
    router.refresh();
  }

  return (
    <div style={{ padding: "18px 0", borderBottom: "1px solid var(--color-divider)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
        <div>
          <div style={{ font: "700 15px/1.2 var(--font-heading)" }}>{action.title}</div>
          <p style={{ margin: "6px 0 0", fontSize: 13 }} className="text-muted">{action.summary}</p>
        </div>
        {!open && (
          <button
            className={action.destructive ? "btn btn-secondary" : "btn btn-primary"}
            onClick={() => setOpen(true)}
            disabled={disabled}
            title={disabled ? "Gmail isn't connected." : undefined}
          >
            {action.title}
          </button>
        )}
      </div>

      {result && <p style={{ fontSize: 12.5, marginTop: 10, color: "var(--color-accent-700)" }}>{result}</p>}

      {open && (
        <div style={{ marginTop: 14, padding: "14px 16px", background: "var(--color-neutral-200)", borderLeft: "2px solid var(--color-accent)" }}>
          <p style={{ margin: 0, fontSize: 13, maxWidth: "44em" }}>{action.consequence}</p>
          {action.destructive && (
            <label style={{ display: "block", marginTop: 12, fontSize: 12 }} className="text-muted">
              Type <strong style={{ color: "var(--color-text)" }}>{action.confirm}</strong> to confirm
              <input
                className="input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                style={{ marginTop: 6, maxWidth: 280 }}
                autoFocus
              />
            </label>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={run} disabled={!ready || busy}>
              {busy ? "Working…" : action.confirm}
            </button>
            <button className="btn btn-ghost" onClick={() => { setOpen(false); setTyped(""); setError(null); }}>
              Cancel
            </button>
            {error && <span style={{ fontSize: 12, color: "var(--color-accent-700)" }}>{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
