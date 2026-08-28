// The plan step's scan: how many emails in this mailbox look like flight
// mail. One Gmail search page — no bodies are fetched, nothing is stored.
import { NextResponse } from "next/server";
import pg from "pg";
import { countCandidates, refreshAccessToken } from "@trailhead/gmail";
import { GMAIL_SEARCH_QUERY } from "@trailhead/domain";
import { supabaseServer } from "../../../lib/supabase/server";

let pool: pg.Pool | undefined;

export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

  try {
    const { rows: [secret] } = await pool.query(
      `select decrypted_secret from vault.decrypted_secrets where name = 'gmail_refresh:' || $1::text`,
      [user.id],
    );
    if (!secret) return NextResponse.json({ error: "no_token" }, { status: 409 });
    const accessToken = await refreshAccessToken(secret.decrypted_secret);
    const candidates = await countCandidates(accessToken, GMAIL_SEARCH_QUERY);
    return NextResponse.json({ candidates }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("scan failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "scan_failed" }, { status: 502 });
  }
}
