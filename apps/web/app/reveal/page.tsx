// The magic moment (frames 1d/1i). Reached from the import when it finishes;
// linkable on its own so you can come back to it.
import { redirect } from "next/navigation";
import { supabaseServer } from "../../lib/supabase/server";
import { Reveal, type RevealStats } from "./Reveal";
import type { Airport, Route } from "../dashboard/map/RouteMap";

export default async function RevealPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connect");

  const { data: stats } = await supabase.rpc("reveal_stats");
  const s = stats as RevealStats | null;
  if (!s || s.flights === 0) redirect("/import");

  const { data: flights } = await supabase
    .from("flights")
    .select("origin_iata, dest_iata")
    .eq("status", "flown");

  const routeCounts = new Map<string, Route>();
  for (const f of flights ?? []) {
    const key = [f.origin_iata, f.dest_iata].sort().join("-");
    const existing = routeCounts.get(key);
    if (existing) existing.count += 1;
    else routeCounts.set(key, { origin: f.origin_iata, dest: f.dest_iata, count: 1 });
  }

  const codes = [...new Set((flights ?? []).flatMap((f) => [f.origin_iata, f.dest_iata]))];
  const { data: airportRows } = codes.length
    ? await supabase.from("airports").select("iata, name, lat, lon").in("iata", codes)
    : { data: [] };

  return (
    <Reveal
      stats={s}
      airports={(airportRows ?? []) as Airport[]}
      routes={[...routeCounts.values()]}
    />
  );
}
