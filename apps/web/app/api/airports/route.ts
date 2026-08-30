// Airport search for the add-a-flight picker.
//
// It deliberately knows nothing about who is asking. The person's own airports
// are already in the browser (the Flights page hands them over), so the client
// hoists its own above anything here — which is both faster than a second
// query per keystroke and keeps a list of someone's airports out of a URL.
// This endpoint answers only "what in the world matches these letters".
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase/server";

export interface AirportHit {
  iata: string;
  name: string;
  municipality: string | null;
  iso_country: string;
  type: string | null;
}

/** Big airports first among equals: without this, "London" ranks eight
 *  airports alphabetically and Heathrow comes fifth. */
const SIZE: Record<string, number> = {
  large_airport: 0, medium_airport: 1, small_airport: 2,
  seaplane_base: 3, heliport: 4,
};

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ hits: [] });

  const supabase = await supabaseServer();
  const term = q.replace(/[%_,()]/g, "");
  if (!term) return NextResponse.json({ hits: [] });

  const { data, error } = await supabase
    .from("airports")
    .select("iata, name, municipality, iso_country, type")
    .or([
      `iata.ilike.${term}%`,
      `municipality.ilike.${term}%`,
      `name.ilike.%${term}%`,
    ].join(","))
    .limit(120);

  if (error) {
    console.error("[airports] search failed:", error.message);
    return NextResponse.json({ hits: [] }, { status: 502 });
  }

  const upper = term.toUpperCase();
  const lower = term.toLowerCase();
  const matchClass = (a: AirportHit) => {
    if (a.iata === upper) return 0;                                   // typed the code
    if (a.iata.startsWith(upper)) return 1;
    if (a.municipality?.toLowerCase().startsWith(lower)) return 2;    // typed the city
    if (a.name.toLowerCase().startsWith(lower)) return 3;
    return 4;                                                         // matched somewhere
  };

  const hits = (data as AirportHit[])
    .sort((a, b) =>
      matchClass(a) - matchClass(b) ||
      (SIZE[a.type ?? ""] ?? 9) - (SIZE[b.type ?? ""] ?? 9) ||
      a.iata.localeCompare(b.iata))
    .slice(0, 8);

  return NextResponse.json({ hits }, {
    // Airport reference data does not change between keystrokes.
    headers: { "cache-control": "private, max-age=300" },
  });
}
