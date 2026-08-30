// Re-derive this person's history from their truth set. No Gmail, no job — the
// same shared module the worker finishes an import with.
//
// Used after "delete my history", which removes the derived flights but keeps
// the ones someone typed in: those are inputs, so they come back only when the
// history is built again.
import { NextResponse } from "next/server";
import pg from "pg";
import { rebuildHistory } from "@trailhead/history";
import { supabaseServer } from "../../../lib/supabase/server";

let pool: pg.Pool | undefined;

export async function POST() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const built = await rebuildHistory(pool, user.id);
    return NextResponse.json({ ok: true, ...built });
  } catch (err) {
    console.error("[rebuild] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "rebuild_failed" }, { status: 500 });
  }
}
