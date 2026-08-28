// Disconnecting revokes the grant at Google as well as destroying our copy —
// otherwise "disconnect" would only mean "we stopped using it".
import { NextResponse } from "next/server";
import pg from "pg";
import { supabaseServer } from "../../../lib/supabase/server";

let pool: pg.Pool | undefined;

export async function POST() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  if (process.env.DATABASE_URL) {
    pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
    try {
      const { rows: [secret] } = await pool.query(
        `select decrypted_secret from vault.decrypted_secrets where name = 'gmail_refresh:' || $1::text`,
        [user.id],
      );
      if (secret?.decrypted_secret) {
        // Best effort: if Google refuses, we still destroy our own copy below.
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: secret.decrypted_secret }),
        }).catch(() => undefined);
      }
    } catch (err) {
      console.error("revoke lookup failed:", err instanceof Error ? err.message : err);
    }
  }

  const { error } = await supabase.rpc("disconnect_gmail");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
