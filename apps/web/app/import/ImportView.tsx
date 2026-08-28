"use client";

// Frame 1c: the progress page is a VIEW of job state — Realtime subscription
// on the user's import_jobs row, 2s polling as fallback. The worker never
// talks to browsers.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "../../lib/supabase/client";
import { StartImport } from "./StartImport";

// A failed import always says what happened and what to do next — never a
// dead end (pipeline ticket: per-item failures are surfaced, and so are the
// job-level ones).
const FAILURES: Record<string, { title: string; detail: string; action: "retry" | "reconnect" }> = {
  gmail_token_revoked: {
    title: "Gmail access expired.",
    detail:
      "Google's consent for this app lapsed — that's normal while Trailhead is in testing, where approvals expire every 7 days. Reconnect and the import picks up where it left off; nothing already imported is lost.",
    action: "reconnect",
  },
  gmail_client_credentials: {
    title: "We couldn't reach Gmail.",
    detail:
      "Trailhead's own Google credentials were rejected, so this isn't something you did — nothing was read and nothing was lost. It needs an operator fix before the import can run.",
    action: "retry",
  },
  gmail_auth_failed: {
    title: "We couldn't reach Gmail.",
    detail: "Google refused the connection. Nothing was read. Try again in a moment.",
    action: "retry",
  },
  pipeline_error: {
    title: "The import stopped early.",
    detail:
      "Something broke mid-run. Anything already extracted was kept — starting again resumes rather than re-reading your mailbox.",
    action: "retry",
  },
};

export interface JobRow {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  stage: string;
  counters: Record<string, number>;
  batch_current: number | null;
  batch_total: number | null;
}

const STAGE_LABELS: [string, (c: Record<string, number>) => string][] = [
  ["connect", () => "Connected to Gmail"],
  ["search", (c) => c.candidates != null ? `Searched mailbox — ${c.candidates.toLocaleString()} candidates` : "Searching mailbox"],
  ["skip_cached", (c) => c.cached_skipped != null ? `${c.cached_skipped.toLocaleString()} cached, skipped` : "Checking cache"],
  ["extract", (c) => `Extracting flights — ${(c.processed ?? 0).toLocaleString()} / ${(((c.candidates ?? 0) - (c.cached_skipped ?? 0))).toLocaleString()}`],
  ["deduplicate", () => "Deduplicating"],
  ["reconstruct_trips", () => "Reconstructing trips"],
  ["build_history", () => "Building your history"],
];

export function ImportView({ initialJob }: { initialJob: JobRow }) {
  const [job, setJob] = useState<JobRow>(initialJob);

  useEffect(() => {
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`job-${initialJob.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "import_jobs", filter: `id=eq.${initialJob.id}` },
        (payload) => setJob(payload.new as JobRow),
      )
      .subscribe();
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("import_jobs").select("id,status,stage,counters,batch_current,batch_total")
        .eq("id", initialJob.id).single();
      if (data) setJob(data as JobRow);
    }, 2000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [initialJob.id]);

  const c = job.counters ?? {};
  const stageIndex = STAGE_LABELS.findIndex(([k]) => k === job.stage);
  const done = job.status === "completed";
  const failed = job.status === "failed";
  const failure = failed
    ? (FAILURES[String((job.counters as Record<string, unknown>)?.error_code ?? "pipeline_error")] ??
       FAILURES.pipeline_error!)
    : null;
  const totalToProcess = Math.max(1, (c.candidates ?? 0) - (c.cached_skipped ?? 0));
  const pct = done ? 100 : Math.min(99, Math.round(
    ((stageIndex >= 3 ? (c.processed ?? 0) / totalToProcess : 0) * 80) + stageIndex * 4,
  ));

  const rows = useMemo(() =>
    STAGE_LABELS.map(([key, label], i) => {
      const state = done || i < stageIndex ? "done" : i === stageIndex ? "active" : "pending";
      return { key, text: label(c), state };
    }), [c, stageIndex, done]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.25fr .75fr" }}>
      <div style={{ padding: "30px 24px", borderRight: "2px solid var(--color-text)" }}>
        <h3 style={{ marginBottom: failure ? 12 : 24 }}>
          {done ? "Your travel history is ready." : failure ? failure.title : "Reading your mailbox"}
        </h3>
        {failure && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ maxWidth: "34em", fontSize: 13.5 }} className="text-muted">
              {failure.detail}
            </p>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14 }}>
              {failure.action === "reconnect" ? (
                <Link href="/connect" className="btn btn-primary">Reconnect Gmail</Link>
              ) : (
                <StartImport label="Try again" />
              )}
            </div>
          </div>
        )}
        <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>
          {rows.map((r) => (
            <div key={r.key} style={{
              display: "flex", gap: 10, padding: "9px 0",
              borderTop: "1px solid color-mix(in srgb, var(--color-text) 20%, transparent)",
              fontWeight: r.state === "active" ? 700 : 400,
              color: r.state === "pending" ? "color-mix(in srgb, var(--color-text) 40%, transparent)" : "inherit",
            }}>
              <span style={{ color: r.state === "done" ? "var(--color-accent)" : "inherit", fontWeight: 700 }}>
                {r.state === "done" ? "✓" : r.state === "active" ? "▸" : "·"}
              </span>
              <span>{r.text}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22, height: 10, background: "var(--color-neutral-300)", display: "flex" }}>
          <div style={{ width: `${pct}%`, background: failed ? "var(--color-neutral-500)" : "var(--color-accent)", transition: "width .6s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, font: "600 11px/1.4 var(--font-body)", color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
          <span>{pct}%</span>
          <span>
            {(c.failures ?? 0) > 0 && `${c.failures} email${c.failures === 1 ? "" : "s"} could not be parsed — we'll show you which`}
          </span>
        </div>
        {c.extraction_degraded ? (
          <div style={{ marginTop: 18, padding: "12px 14px", borderLeft: "2px solid var(--color-accent)", background: "var(--color-accent-100)" }}>
            <div style={{ font: "700 10px/1 var(--font-body)", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--color-accent-700)", marginBottom: 8 }}>
              Incomplete import
            </div>
            <p style={{ margin: 0, fontSize: 13, maxWidth: "34em" }}>
              AI extraction became unavailable partway through, so{" "}
              {(c.failures ?? 0).toLocaleString()} email
              {(c.failures ?? 0) === 1 ? "" : "s"} that need it were skipped —
              emails the deterministic reader handled are still here. Those
              skipped were left unread, so running the import again picks up
              exactly them.
            </p>
          </div>
        ) : null}
        {done && (
          <div style={{ display: "flex", gap: 14, marginTop: 22, borderTop: "2px solid var(--color-text)", paddingTop: 20, alignItems: "center" }}>
            {c.extraction_degraded ? (
              <StartImport label="Run the rest" />
            ) : (
              <Link href="/reveal" className="btn btn-primary">See my travel history</Link>
            )}
            <span style={{ fontSize: 12 }} className="text-muted">
              {c.extraction_degraded ? "Resumes with the skipped emails" : "Then your dashboard"}
            </span>
          </div>
        )}
      </div>
      <div style={{ padding: "30px 24px" }}>
        <h6 style={{ color: "color-mix(in srgb, var(--color-text) 50%, transparent)", marginBottom: 16 }}>Found so far</h6>
        <div style={{ borderTop: "2px solid var(--color-text)" }}>
          {[
            ["Flights", done ? (c.total_flights ?? c.flights ?? 0) : (c.flights_found ?? 0)],
            ["Countries", c.total_countries ?? null],
            ["Trips", c.trips ?? null],
          ].map(([label, value]) =>
            value == null ? null : (
              <div key={label as string} style={{ padding: "12px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div style={{ font: "700 30px/1 var(--font-heading)" }}>{(value as number).toLocaleString()}</div>
                <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginTop: 6 }}>{label}</h6>
              </div>
            ),
          )}
        </div>
        <p style={{ marginTop: 18, fontSize: 11.5 }} className="text-muted">
          {done
            ? "Your history is ready to look at."
            : "You can close this tab. We'll email you when it's done."}
        </p>
      </div>
    </div>
  );
}
