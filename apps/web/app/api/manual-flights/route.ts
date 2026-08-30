// Adding, changing and removing a flight someone typed in.
//
// Each write goes through the definer RPC (which scopes it to the caller) and
// is then followed by a full rebuild through the shared module, in the same
// transaction: a manual flight is an *input* to the history, so the history has
// to be re-derived before the person sees it. If the rebuild fails, the write
// rolls back with it — better no flight than a flight and a broken history.
import { NextResponse } from "next/server";
import pg from "pg";
import { rebuildHistory } from "@trailhead/history";
import { supabaseServer } from "../../../lib/supabase/server";

let pool: pg.Pool | undefined;

interface Body {
  id?: string;
  origin?: string;
  dest?: string;
  date?: string;
  airline?: string | null;
  flightNumber?: string | null;
  depTime?: string | null;
  arrTime?: string | null;
  bookingRef?: string | null;
  price?: number | null;
  currency?: string | null;
}

const IATA = /^[A-Z]{3}$/;

async function withRebuild(
  userId: string,
  write: (c: pg.PoolClient) => Promise<void>,
) {
  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("begin");
    // The RPCs read auth.uid(); this connection is the service role, so the
    // caller's identity has to be stated explicitly for the transaction.
    await client.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: userId })]);
    await write(client);
    const built = await rebuildHistory(client, userId);
    await client.query("commit");
    return built;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("not_authenticated", 401);

  const b = (await request.json()) as Body;
  const origin = b.origin?.toUpperCase() ?? "";
  const dest = b.dest?.toUpperCase() ?? "";
  if (!IATA.test(origin) || !IATA.test(dest)) return fail("Pick a departure and an arrival airport.");
  if (origin === dest) return fail("A flight has to go somewhere else.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date ?? "")) return fail("Pick a date.");

  try {
    const built = await withRebuild(user.id, async (c) => {
      await c.query(
        `select public.add_manual_flight($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [origin, dest, b.date, b.airline || null, b.flightNumber || null,
         b.depTime || null, b.arrTime || null, b.bookingRef || null,
         b.price ?? null, b.currency || null],
      );
    });
    return NextResponse.json({ ok: true, ...built });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("manual_flight_limit")) {
      return fail("You've added a great many flights by hand. Tell us — that's a limit we want to hear about.", 409);
    }
    if (message.includes("violates foreign key")) return fail("We don't know one of those airports.");
    console.error("[manual-flights] add failed:", message);
    return fail("Couldn't save that flight.", 500);
  }
}

export async function PATCH(request: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("not_authenticated", 401);

  const b = (await request.json()) as Body;
  const origin = b.origin?.toUpperCase() ?? "";
  const dest = b.dest?.toUpperCase() ?? "";
  if (!b.id) return fail("Which flight?");
  if (!IATA.test(origin) || !IATA.test(dest)) return fail("Pick a departure and an arrival airport.");
  if (origin === dest) return fail("A flight has to go somewhere else.");

  try {
    const built = await withRebuild(user.id, async (c) => {
      await c.query(
        `select public.update_manual_flight($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [b.id, origin, dest, b.date, b.airline || null, b.flightNumber || null,
         b.depTime || null, b.arrTime || null, b.bookingRef || null,
         b.price ?? null, b.currency || null],
      );
    });
    return NextResponse.json({ ok: true, ...built });
  } catch (err) {
    console.error("[manual-flights] update failed:", err instanceof Error ? err.message : err);
    return fail("Couldn't save that change.", 500);
  }
}

export async function DELETE(request: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("not_authenticated", 401);

  const { id } = (await request.json()) as { id?: string };
  if (!id) return fail("Which flight?");

  try {
    // Deleting goes through the rebuild too: dropping the row is not enough,
    // because trips and the per-year home airport were derived *with* it.
    const built = await withRebuild(user.id, async (c) => {
      await c.query(`select public.delete_manual_flight($1)`, [id]);
    });
    return NextResponse.json({ ok: true, ...built });
  } catch (err) {
    console.error("[manual-flights] delete failed:", err instanceof Error ? err.message : err);
    return fail("Couldn't remove that flight.", 500);
  }
}
