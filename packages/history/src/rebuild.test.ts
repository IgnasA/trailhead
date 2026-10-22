// rebuildHistory end to end, against the repo's own migrations in an
// in-process Postgres (PGlite). No network, no real database: the Supabase
// pieces the migrations lean on — the auth schema, its roles, the realtime
// publication — are stubbed just far enough for them to apply.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import type { FlightExtraction } from "@trailhead/domain";
import { rebuildHistory, type Queryable } from "./index.js";

const MIGRATIONS = fileURLToPath(new URL("../../../supabase/migrations/", import.meta.url));
const USER = "00000000-0000-4000-8000-000000000001";

async function freshDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create role authenticated; create role anon; create role service_role;
    create publication supabase_realtime;
  `);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(MIGRATIONS + file, "utf8"));
  }
  await db.query(`insert into auth.users (id) values ($1)`, [USER]);
  await db.exec(`
    insert into airports (iata, name, municipality, iso_country, lat, lon, tz) values
      ('VNO', 'Vilnius', 'Vilnius', 'LT', 54.6341, 25.2858, 'Europe/Vilnius'),
      ('VIL', 'Dakhla', 'Dakhla', 'EH', 23.7183, -15.932, 'Africa/El_Aaiun'),
      ('FRA', 'Frankfurt', 'Frankfurt', 'DE', 50.0333, 8.5706, 'Europe/Berlin'),
      ('LHR', 'Heathrow', 'London', 'GB', 51.4706, -0.4619, 'Europe/London');
  `);
  return db;
}

let emailSeq = 0;
async function email(db: PGlite, over: Partial<FlightExtraction>): Promise<string> {
  const payload: FlightExtraction = {
    isFlightEmail: true, emailType: "confirmation", airlineIata: "LH", airlineName: null,
    flightNumber: null, originIata: null, destIata: null, departureDate: null,
    depLocalTime: null, arrLocalTime: null, bookingRef: null, priceAmount: null,
    priceCurrency: null, ...over,
  };
  emailSeq += 1;
  const { rows: [source] } = await db.query<{ id: string }>(
    `insert into source_emails (user_id, gmail_message_id, content_hash)
     values ($1, $2, $2) returning id`,
    [USER, `msg-${emailSeq}`],
  );
  const { rows: [extraction] } = await db.query<{ id: string }>(
    `insert into email_extractions (user_id, source_email_id, extraction_version, tier, payload, confidence)
     values ($1, $2, 1, 'llm', $3, 0.7) returning id`,
    [USER, source!.id, JSON.stringify(payload)],
  );
  return extraction!.id;
}

interface FlightRow {
  id: string; status: string; airline_iata: string | null; flight_number: string | null;
  departure_date: string; origin_iata: string; dest_iata: string; distance_km: number;
  trip_id: string | null;
}
const flights = async (db: PGlite) =>
  (await db.query<FlightRow>(
    `select id, status, airline_iata, flight_number, to_char(departure_date, 'YYYY-MM-DD') as departure_date,
            origin_iata, dest_iata, distance_km, trip_id
     from flights where user_id=$1 order by departure_date, origin_iata`, [USER],
  )).rows;
const find = async (db: PGlite, date: string) => (await flights(db)).find((f) => f.departure_date === date)!;
const tripTitles = async (db: PGlite) =>
  (await db.query<{ title: string }>(`select title from trips where user_id=$1 order by start_date`, [USER]))
    .rows.map((t) => t.title);

/** What record_correction does from the web app: store the event, carrying the
 *  identity the flight detail page sends, and apply its effect to the row. */
async function correct(db: PGlite, flight: FlightRow, kind: string, fix: Record<string, string> = {}) {
  const target = {
    airline_iata: flight.airline_iata, flight_number: flight.flight_number,
    departure_date: flight.departure_date, origin_iata: flight.origin_iata, dest_iata: flight.dest_iata,
  };
  await db.query(
    `insert into corrections (user_id, kind, flight_id, payload) values ($1, $2, $3, $4)`,
    [USER, kind, flight.id, JSON.stringify({ ...fix, target })],
  );
  await applyEffect(db, flight.id, kind, fix);
}
async function applyEffect(db: PGlite, flightId: string, kind: string, fix: Record<string, string>) {
  if (kind === "not_a_flight") {
    await db.query(`update flights set status='not_a_flight' where id=$1`, [flightId]);
  } else {
    await db.query(`update flights set origin_iata=$2, dest_iata=$3 where id=$1`,
      [flightId, fix.origin_iata, fix.dest_iata]);
  }
}

describe("rebuildHistory replays corrections", () => {
  let db: PGlite;
  // PGlite's query has the right shape; the cast only narrows its generics.
  const rebuild = () => rebuildHistory(db as unknown as Queryable, USER);

  beforeEach(async () => {
    db = await freshDatabase();
    // A year from Vilnius. The March outbound was read as VIL (Dakhla) — the
    // real wrong-but-real-airport bug from ticket 018 — and the June "flight"
    // was a fare-sale email.
    await email(db, { flightNumber: "881", originIata: "VIL", destIata: "FRA", departureDate: "2024-03-01" });
    await email(db, { flightNumber: "882", originIata: "FRA", destIata: "VNO", departureDate: "2024-03-05" });
    await email(db, { airlineIata: "BA", flightNumber: "123", originIata: "VNO", destIata: "LHR", departureDate: "2024-06-01", emailType: "marketing" });
    await email(db, { flightNumber: "883", originIata: "VNO", destIata: "FRA", departureDate: "2024-08-01" });
    await email(db, { flightNumber: "884", originIata: "FRA", destIata: "VNO", departureDate: "2024-08-03" });
    await email(db, { airlineIata: "BA", flightNumber: "875", originIata: "VNO", destIata: "LHR", departureDate: "2024-10-01" });
    await email(db, { airlineIata: "BA", flightNumber: "874", originIata: "LHR", destIata: "VNO", departureDate: "2024-10-04" });
  });

  it("starts from the uncorrected history", async () => {
    const built = await rebuild();
    expect(built).toMatchObject({ flights: 7, flown: 7, corrections: { applied: 0, unmatched: 0 } });
    expect((await find(db, "2024-03-01")).origin_iata).toBe("VIL");
    expect(await tripTitles(db)).toEqual(["VNO → FRA → VNO", "VNO → LHR → VNO"]);
  });

  it("keeps an airport fix across a rebuild, with distance and trips rebuilt from it", async () => {
    await rebuild();
    const wrong = await find(db, "2024-03-01");
    await correct(db, wrong, "correct_field", { origin_iata: "VNO", dest_iata: "FRA" });

    const built = await rebuild();
    expect(built.corrections).toEqual({ applied: 1, unmatched: 0 });
    const fixed = await find(db, "2024-03-01");
    expect(fixed.origin_iata).toBe("VNO");
    expect(fixed.distance_km).toBeGreaterThan(1000);
    expect(fixed.distance_km).toBeLessThan(1300); // VNO–FRA, not the 3,000+ km from Dakhla
    // The March legs now close at home, so they are a trip rather than review.
    expect(await tripTitles(db)).toEqual([
      "VNO → FRA → VNO", "VNO → FRA → VNO", "VNO → LHR → VNO",
    ]);
    // The provenance link to the email survives the correction.
    const { rows: links } = await db.query(`select 1 from flight_sources where flight_id=$1`, [fixed.id]);
    expect(links).toHaveLength(1);
  });

  it("keeps a 'not a flight' out of stats and trips, as a labelled row", async () => {
    await rebuild();
    await correct(db, await find(db, "2024-06-01"), "not_a_flight");

    const built = await rebuild();
    expect(built).toMatchObject({ flights: 7, flown: 6, corrections: { applied: 1, unmatched: 0 } });
    const marked = await find(db, "2024-06-01");
    expect(marked.status).toBe("not_a_flight");
    expect(marked.trip_id).toBeNull();
    const { rows: [review] } = await db.query<{ needs_review: boolean }>(
      `select needs_review from flights where id=$1`, [marked.id]);
    expect(review!.needs_review).toBe(false);
  });

  it("is idempotent: rebuilding again changes nothing", async () => {
    await rebuild();
    await correct(db, await find(db, "2024-03-01"), "correct_field", { origin_iata: "VNO", dest_iata: "FRA" });
    await correct(db, await find(db, "2024-06-01"), "not_a_flight");
    const first = await rebuild();
    const shape = async () => (await flights(db)).map(({ id: _id, trip_id: _t, ...rest }) => rest);
    const before = await shape();
    const second = await rebuild();
    expect(second).toEqual(first);
    expect(await shape()).toEqual(before);
  });

  it("recovers corrections recorded before replay existed, while their flight id still resolves", async () => {
    await rebuild();
    const wrong = await find(db, "2024-03-01");
    const marketing = await find(db, "2024-06-01");
    // The old shape: no target, and the effect already applied to the row —
    // so the row itself now shows the corrected route.
    for (const [flight, kind, fix] of [
      [wrong, "correct_field", { origin_iata: "VNO", dest_iata: "FRA" }],
      [marketing, "not_a_flight", {}],
    ] as const) {
      await db.query(`insert into corrections (user_id, kind, flight_id, payload) values ($1, $2, $3, $4)`,
        [USER, kind, flight.id, JSON.stringify(fix)]);
      await applyEffect(db, flight.id, kind, fix);
    }

    const built = await rebuild();
    expect(built.corrections).toEqual({ applied: 2, unmatched: 0 });
    expect((await find(db, "2024-03-01")).origin_iata).toBe("VNO");
    expect((await find(db, "2024-06-01")).status).toBe("not_a_flight");

    // Stamped with the identity the emails gave, not the corrected row's, and
    // the event itself left as it was.
    const { rows } = await db.query<{ kind: string; payload: Record<string, unknown>; flight_id: string | null }>(
      `select kind, payload, flight_id from corrections order by kind`);
    expect(rows[0]!.payload).toMatchObject({
      origin_iata: "VNO", dest_iata: "FRA",
      target: { origin_iata: "VIL", dest_iata: "FRA", departure_date: "2024-03-01", flight_number: "881" },
    });
    expect(rows[1]!.payload).toMatchObject({ target: { origin_iata: "VNO", dest_iata: "LHR" } });
    expect(rows.every((r) => r.flight_id === null)).toBe(true);

    // And a second rebuild still applies them, now by target alone.
    expect((await rebuild()).corrections).toEqual({ applied: 2, unmatched: 0 });
  });

  it("holds a correction whose flight has gone, and applies it when it comes back", async () => {
    await rebuild();
    await correct(db, await find(db, "2024-06-01"), "not_a_flight");
    // "Delete my emails", then a rebuild with nothing to rebuild from.
    await db.query(`delete from source_emails where user_id=$1`, [USER]);
    expect(await rebuild()).toMatchObject({ flights: 0, corrections: { applied: 0, unmatched: 1 } });
    // The next import reads the same email again.
    await email(db, { airlineIata: "BA", flightNumber: "123", originIata: "VNO", destIata: "LHR", departureDate: "2024-06-01" });
    expect(await rebuild()).toMatchObject({ flights: 1, flown: 0, corrections: { applied: 1 } });
  });
});
