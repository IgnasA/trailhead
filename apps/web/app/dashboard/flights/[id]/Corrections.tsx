"use client";

// "Correct this flight" and "Not a flight" (frame 1h). Every one is stored as
// an immutable correction — which is also the labelled eval dataset the
// extraction pipeline is measured against (pipeline ticket).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../../lib/supabase/client";

export function Corrections({
  flightId, origin, dest,
}: {
  flightId: string; origin: string; dest: string;
}) {
  const [mode, setMode] = useState<"idle" | "fields" | "busy" | "done">("idle");
  const [newOrigin, setNewOrigin] = useState(origin);
  const [newDest, setNewDest] = useState(dest);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function send(kind: "not_a_flight" | "correct_field", payload: object = {}) {
    setMode("busy");
    setError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.rpc("record_correction", {
      p_kind: kind,
      p_flight_id: flightId,
      p_payload: payload,
    });
    if (error) {
      setError("Couldn't save that correction.");
      setMode("idle");
      return;
    }
    setMode("done");
    router.refresh();
  }

  const valid = (code: string) => /^[A-Z]{3}$/.test(code.trim().toUpperCase());

  if (mode === "done") {
    return (
      <p style={{ fontSize: 12.5, marginTop: 20 }} className="text-muted">
        Saved — and kept as an example the extraction is measured against.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 20 }}>
      {mode === "fields" ? (
        <div style={{ padding: "14px 16px", background: "var(--color-neutral-200)", borderLeft: "2px solid var(--color-accent)" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13 }}>
            Fix the airports we read. Your correction is kept as a labelled example.
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ fontSize: 12 }} className="text-muted">
              From
              <input className="input" value={newOrigin} maxLength={3}
                onChange={(e) => setNewOrigin(e.target.value.toUpperCase())}
                style={{ width: 90, marginTop: 4, fontFamily: "ui-monospace, Menlo, monospace" }} />
            </label>
            <label style={{ fontSize: 12 }} className="text-muted">
              To
              <input className="input" value={newDest} maxLength={3}
                onChange={(e) => setNewDest(e.target.value.toUpperCase())}
                style={{ width: 90, marginTop: 4, fontFamily: "ui-monospace, Menlo, monospace" }} />
            </label>
            <button
              className="btn btn-primary"
              disabled={!valid(newOrigin) || !valid(newDest) || (newOrigin === origin && newDest === dest)}
              onClick={() => send("correct_field", { origin_iata: newOrigin.trim(), dest_iata: newDest.trim() })}
            >
              Save correction
            </button>
            <button className="btn btn-ghost" onClick={() => setMode("idle")}>Cancel</button>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 11 }} className="text-muted">
            Distances and trips are rebuilt from the corrected airports on the next import.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn-secondary" onClick={() => setMode("fields")} disabled={mode === "busy"}>
            Correct this flight
          </button>
          <button className="btn btn-secondary" onClick={() => send("not_a_flight")} disabled={mode === "busy"}>
            Not a flight
          </button>
          {error && <span style={{ fontSize: 12, color: "var(--color-accent-700)" }}>{error}</span>}
        </div>
      )}
    </div>
  );
}
