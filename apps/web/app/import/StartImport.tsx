"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../lib/supabase/client";

export function StartImport({
  label = "Read my mailbox",
  variant = "btn-primary",
}: {
  label?: string;
  variant?: "btn-primary" | "btn-secondary";
}) {
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
      <button className={`btn ${variant}`} onClick={start} disabled={busy}>
        {busy ? "Starting…" : label}
      </button>
      {error && <p style={{ marginTop: 10, fontSize: 13, color: "var(--color-accent-700)" }}>{error}</p>}
    </div>
  );
}
