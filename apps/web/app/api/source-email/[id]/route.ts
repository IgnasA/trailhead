// Frame 1h's "view source": the body is fetched live from Gmail with the
// stored message id and never persisted — close the panel and it's gone.
// The Gmail token is read server-side from Vault and never reaches the
// browser (privacy ticket + ADR 0001).
import { NextResponse } from "next/server";
import pg from "pg";
import { fetchEmail, refreshAccessToken } from "@trailhead/gmail";
import { bodyForExtraction } from "@trailhead/domain";
import { supabaseServer } from "../../../../lib/supabase/server";

let pool: pg.Pool | undefined;
function db() {
  if (!process.env.DATABASE_URL) return null;
  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  return pool;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // RLS scopes this to the caller — an id from another account simply misses.
  const { data: source } = await supabase
    .from("source_emails")
    .select("gmail_message_id")
    .eq("id", id)
    .maybeSingle();
  if (!source) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const conn = db();
  if (!conn) {
    return NextResponse.json(
      { error: "not_configured", detail: "DATABASE_URL is not set for the web app." },
      { status: 503 },
    );
  }

  try {
    const { rows: [secret] } = await conn.query(
      `select decrypted_secret from vault.decrypted_secrets where name = 'gmail_refresh:' || $1::text`,
      [user.id],
    );
    if (!secret) return NextResponse.json({ error: "no_token" }, { status: 409 });

    const accessToken = await refreshAccessToken(secret.decrypted_secret);
    const email = await fetchEmail(accessToken, source.gmail_message_id);
    const body = bodyForExtraction(email.text, email.html, 20000);

    return NextResponse.json(
      { subject: email.subject, from: email.from, receivedAt: email.receivedAt, body },
      // Explicitly uncacheable: the whole promise is that we don't keep it.
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("source-email fetch failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
