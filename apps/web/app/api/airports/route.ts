// PROTOTYPE support (ticket: Choosing an airport from nine thousand).
// Server-side airport search, so the three picker variants are judged against
// real latency rather than an in-memory array. Precedence is the thing being
// tested: exact code beats code-prefix beats city beats name.
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase/server";

export interface AirportHit {
  iata: string;
  name: string;
  municipality: string | null;
  iso_country: string;
  /** How many of the caller's own flights touch this airport. */
  mine: number;
}

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ hits: [] });

  const supabase = await supabaseServer();

  // Airports this person already flies, which is the strongest ranking signal
  // available and costs one query.
  const { data: own } = await supabase.from("flights").select("origin_iata, dest_iata");
  const mine = new Map<string, number>();
  for (const f of own ?? []) {
    mine.set(f.origin_iata, (mine.get(f.origin_iata) ?? 0) + 1);
    mine.set(f.dest_iata, (mine.get(f.dest_iata) ?? 0) + 1);
  }

  const like = q.replace(/[%_]/g, "");
  const { data } = await supabase
    .from("airports")
    .select("iata, name, municipality, iso_country")
    .or([
      `iata.ilike.${like}%`,
      `municipality.ilike.${like}%`,
      `name.ilike.%${like}%`,
    ].join(","))
    .limit(80);

  const upper = q.toUpperCase();
  const lower = q.toLowerCase();
  const score = (a: { iata: string; name: string; municipality: string | null }) => {
    if (a.iata === upper) return 0;                                        // typed the code
    if (a.iata.startsWith(upper)) return 1;
    if (a.municipality?.toLowerCase().startsWith(lower)) return 2;         // typed the city
    if (a.name.toLowerCase().startsWith(lower)) return 3;
    return 4;                                                             // matched somewhere
  };

  const hits: AirportHit[] = (data ?? [])
    .map((a) => ({ ...a, mine: mine.get(a.iata) ?? 0 }))
    .sort((a, b) =>
      score(a) - score(b) || b.mine - a.mine || a.iata.localeCompare(b.iata))
    .slice(0, 8);

  return NextResponse.json({ hits }, { headers: { "cache-control": "no-store" } });
}
