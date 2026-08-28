// The step between connecting Gmail and importing: what we found, and which
// plan. Skipped once an import already exists — you only choose once.
import { redirect } from "next/navigation";
import { supabaseServer } from "../../lib/supabase/server";
import { PlanChooser } from "./PlanChooser";

export default async function PlanPage() {
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
    .from("import_jobs").select("id").limit(1).maybeSingle();
  if (job) redirect("/import");

  return <PlanChooser mailbox={connection.email_address} />;
}
