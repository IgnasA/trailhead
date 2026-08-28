// Frame 1c — import progress. The page renders whatever the job row says;
// the worker owns the truth.
import { redirect } from "next/navigation";
import { supabaseServer } from "../../lib/supabase/server";
import { ImportView, type JobRow } from "./ImportView";
import { StartImport } from "./StartImport";

export default async function ImportPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connect");

  const { data: connection } = await supabase
    .from("gmail_connections")
    .select("email_address")
    .eq("status", "connected")
    .maybeSingle();
  if (!connection) redirect("/connect");

  const { data: job } = await supabase
    .from("import_jobs")
    .select("id,status,stage,counters,batch_current,batch_total")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ padding: "14px 24px", borderBottom: "2px solid var(--color-text)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ font: "800 13px/1 var(--font-heading)" }}>TRAILHEAD</span>
        <span style={{ fontSize: 11 }} className="text-muted">
          {job && (job.status === "running" || job.status === "queued")
            ? `Import job · ${job.batch_current ? `batch ${job.batch_current} of ${job.batch_total}` : "starting"}`
            : connection.email_address}
        </span>
      </div>
      {job ? (
        <ImportView initialJob={job as JobRow} />
      ) : (
        <div style={{ padding: "30px 24px" }}>
          <h2 style={{ maxWidth: "16em" }}>Ready to read {connection.email_address}.</h2>
          <p className="text-muted" style={{ maxWidth: "34em", margin: "14px 0 24px" }}>
            Trailhead will search this mailbox for flight emails and extract
            your history. Read-only, batched, and resumable — you can close the
            tab once it starts.
          </p>
          <StartImport />
        </div>
      )}
    </main>
  );
}
