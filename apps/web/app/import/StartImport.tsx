"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../lib/supabase/client";

export function StartImport() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function start() {
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.rpc("start_import");
    if (error) {
      setError("Couldn't start the import. Please try again.");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button className="btn btn-primary" onClick={start} disabled={busy}>
        {busy ? "Starting…" : "Read my mailbox"}
      </button>
      {error && <p style={{ marginTop: 10, fontSize: 13, color: "var(--color-accent-700)" }}>{error}</p>}
    </div>
  );
}
