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
import { isSameOrigin } from "../../../lib/http/sameOrigin";
import { isUuid, parseManualFlight, readJson, type ManualFlightInput } from "../../../lib/http/manualFlight";

let pool: pg.Pool | undefined;

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

/** The RPCs' parameters after the id, in order. */
const fields = (f: ManualFlightInput) => [
  f.origin, f.dest, f.date, f.airline, f.flightNumber,
  f.depTime, f.arrTime, f.bookingRef, f.price, f.currency,
];

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail("forbidden", 403);
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("not_authenticated", 401);

  const parsed = parseManualFlight(await readJson(request));
  if (!parsed.ok) return fail(parsed.error);
  const f = parsed.value;

  try {
    const built = await withRebuild(user.id, async (c) => {
      await c.query(
        `select public.add_manual_flight($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        fields(f),
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
  if (!isSameOrigin(request)) return fail("forbidden", 403);
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("not_authenticated", 401);

  const body = await readJson(request);
  const id = (body as { id?: unknown } | undefined)?.id;
  if (!isUuid(id)) return fail("Which flight?");
  const parsed = parseManualFlight(body);
  if (!parsed.ok) return fail(parsed.error);

  try {
    const built = await withRebuild(user.id, async (c) => {
      await c.query(
        `select public.update_manual_flight($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [id, ...fields(parsed.value)],
      );
    });
    return NextResponse.json({ ok: true, ...built });
  } catch (err) {
    console.error("[manual-flights] update failed:", err instanceof Error ? err.message : err);
    return fail("Couldn't save that change.", 500);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return fail("forbidden", 403);
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("not_authenticated", 401);

  const id = ((await readJson(request)) as { id?: unknown } | undefined)?.id;
  if (!isUuid(id)) return fail("Which flight?");

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
