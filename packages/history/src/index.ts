// Deriving a person's history from their truth set: Extractions in, Flights
// and Trips out. This is the one place the system's central invariant lives —
// Flights hold no independent truth and are rebuilt from scratch every time,
// so anything that must survive a rebuild has to be an input to this function
// rather than a row it writes.
//
// It used to live inline in the worker's import pipeline, reachable only by
// running a Gmail scan first. It is shared because a manual flight has to
// produce the same history without one, and reimplementing the invariant in
// SQL would give it two definitions that will drift.
import {
  EXTRACTION_VERSION,
  TRIP_CHAIN_MAX_GAP_DAYS,
  computeConfidence,
  haversineKm,
  mergeKey,
  normalizeFlightNumber,
  type FlightExtraction,
} from "@trailhead/domain";

/** Anything that can run SQL: a Pool, or a single client — which lets a
 *  caller run the rebuild inside a transaction it controls. */
export interface Queryable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(text: string, values?: unknown[]): Promise<{ rows: any[] }>;
}

/** The stages a caller may want to report progress on. The worker writes them
 *  to the job row that is its state machine; a manual add ignores them. */
export type RebuildStage = "deduplicate" | "reconstruct_trips" | "build_history";

export interface RebuildResult {
  /** Flights written this rebuild, whatever their status. */
  flights: number;
  /** Of those, the ones that have actually happened — what the stats count. */
  flown: number;
  trips: number;
  /** Distinct ISO countries across flown flights — the dashboard's figure. */
  countries: number;
  /** Distinct airports touched by flown flights. */
  airports: number;
}

interface Leg {
  id: string;
  date: string;
  origin: string;
  dest: string;
}

/** One merged segment on its way to becoming a Flight. `manual` is set when a
 *  typed flight contributed, whether or not emails did too. */
interface Group {
  ids: string[];
  tiers: string[];
  ex: FlightExtraction;
  manual: boolean;
}

/** A manual flight, shaped as an extraction so it merges through exactly the
 *  same key and the same field-filling as everything else. */
function asExtraction(row: Record<string, unknown>): FlightExtraction {
  return {
    isFlightEmail: true,
    emailType: "confirmation",
    airlineIata: (row.airline_iata as string) ?? null,
    airlineName: null,
    flightNumber: (row.flight_number as string) ?? null,
    originIata: row.origin_iata as string,
    destIata: row.dest_iata as string,
    departureDate: row.departure_date as string,
    depLocalTime: (row.dep_local_time as string) ?? null,
    arrLocalTime: (row.arr_local_time as string) ?? null,
    bookingRef: (row.booking_ref as string) ?? null,
    // numeric comes back from pg as a string; a price of 0 is still a price.
    priceAmount: row.price_amount == null ? null : Number(row.price_amount),
    priceCurrency: (row.price_currency as string) ?? null,
  };
}

/**
 * Rebuild every Flight and Trip for one user from their stored Extractions.
 *
 * Destructive by design: it deletes the user's Flights and Trips first, then
 * re-derives them. Safe to run at any time, and re-running it changes nothing
 * unless the inputs changed.
 */
export async function rebuildHistory(
  pool: Queryable,
  userId: string,
  onStage?: (stage: RebuildStage) => Promise<void> | void,
): Promise<RebuildResult> {
  const stage = async (s: RebuildStage) => { await onStage?.(s); };

  // ── deduplicate / merge ─────────────────────────────────────────────────
  await stage("deduplicate");
  const { rows: extractionRows } = await pool.query(
    `select id, tier, payload from email_extractions where user_id=$1 and extraction_version=$2`,
    [userId, EXTRACTION_VERSION],
  );

  const groups = new Map<string, Group>();
  for (const row of extractionRows) {
    const ex = row.payload as FlightExtraction;
    if (!ex.originIata || !ex.destIata || !ex.departureDate) continue;
    const key = mergeKey(ex);
    const g = groups.get(key);
    if (g) {
      g.ids.push(row.id);
      g.tiers.push(row.tier);
      // First non-null wins per field: corroborating emails fill each other's
      // gaps without overwriting what an earlier one already established.
      for (const k of Object.keys(ex) as (keyof FlightExtraction)[]) {
        if (g.ex[k] == null && ex[k] != null) (g.ex as Record<string, unknown>)[k] = ex[k];
      }
    } else {
      groups.set(key, { ids: [row.id], tiers: [row.tier], ex: { ...ex }, manual: false });
    }
  }

  // Flights the person typed in themselves, merged through the same key. Where
  // one lands on a flight the import also found, the typed values win: a
  // correction outranks an extraction, and this is a correction made in
  // advance. The email links survive, so provenance can show both.
  const { rows: manualRows } = await pool.query(
    `select id, origin_iata, dest_iata, to_char(departure_date, 'YYYY-MM-DD') as departure_date,
            airline_iata, flight_number,
            to_char(dep_local_time, 'HH24:MI') as dep_local_time,
            to_char(arr_local_time, 'HH24:MI') as arr_local_time,
            booking_ref, price_amount, price_currency
     from manual_flights where user_id=$1`,
    [userId],
  );
  for (const row of manualRows) {
    const mx = asExtraction(row);
    const key = mergeKey(mx);
    const g = groups.get(key);
    if (g) {
      g.manual = true;
      for (const k of Object.keys(mx) as (keyof FlightExtraction)[]) {
        if (mx[k] != null) (g.ex as Record<string, unknown>)[k] = mx[k];
      }
    } else {
      groups.set(key, { ids: [], tiers: [], ex: mx, manual: true });
    }
  }

  const { rows: airportRows } = await pool.query(`select iata, lat, lon, tz from airports`);
  const airports = new Map(airportRows.map((a) => [a.iata as string, a]));

  await pool.query(`delete from flights where user_id=$1`, [userId]);
  const today = new Date().toISOString().slice(0, 10);
  const legs: Leg[] = [];
  let flightCount = 0;

  for (const { ids, tiers, ex, manual } of groups.values()) {
    const origin = airports.get(ex.originIata!);
    const dest = airports.get(ex.destIata!);
    if (!origin || !dest) continue;
    const bestTier = tiers.includes("schema_org")
      ? "schema_org"
      : tiers.includes("kitinerary") ? "kitinerary" : "llm";
    // A typed flight is certain by construction — the person was on it. Stored
    // as 1.0 and never rendered as a percentage: a number would imply we
    // assessed them, and we didn't.
    const confidence = manual
      ? 1
      : computeConfidence(bestTier, ex, {
          originKnown: true, destKnown: true, corroboratingEmails: ids.length - 1,
        });
    const depLocal = ex.depLocalTime ? `${ex.departureDate} ${ex.depLocalTime}` : null;
    const arrLocal = ex.arrLocalTime ? `${ex.departureDate} ${ex.arrLocalTime}` : null;
    const distanceKm = haversineKm(origin.lat, origin.lon, dest.lat, dest.lon);
    const { rows: [f] } = await pool.query(
      `insert into flights (user_id, status, airline_iata, flight_number, origin_iata, dest_iata,
         departure_date, dep_local, dep_tz, arr_local, arr_tz, distance_km, booking_ref,
         price_amount, price_currency, confidence, extraction_version, source)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) returning id`,
      [
        userId,
        ex.departureDate! <= today ? "flown" : "upcoming",
        ex.airlineIata, normalizeFlightNumber(ex.flightNumber, ex.airlineIata),
        ex.originIata, ex.destIata,
        ex.departureDate, depLocal, origin.tz, arrLocal, dest.tz, distanceKm,
        ex.bookingRef, ex.priceAmount, ex.priceCurrency, confidence, EXTRACTION_VERSION,
        manual ? "manual" : "imported",
      ],
    );
    for (const exId of ids) {
      await pool.query(
        `insert into flight_sources (flight_id, extraction_id) values ($1,$2) on conflict do nothing`,
        [f.id, exId],
      );
    }
    flightCount += 1;
    legs.push({ id: f.id, date: ex.departureDate!, origin: ex.originIata!, dest: ex.destIata! });
  }

  await deriveUtc(pool, userId);
  await stage("deduplicate");

  // ── reconstruct trips ───────────────────────────────────────────────────
  await stage("reconstruct_trips");
  const trips = await reconstructTrips(pool, userId, legs);
  await stage("reconstruct_trips");

  // ── build history ───────────────────────────────────────────────────────
  await stage("build_history");
  const { rows: [stats] } = await pool.query(
    `with flown as (select * from flights where user_id=$1 and status='flown'),
          visited as (select origin_iata as iata from flown union select dest_iata from flown)
     select (select count(*)::int from flown) as flights,
            (select count(distinct a.iso_country)::int from visited v join airports a on a.iata=v.iata) as countries,
            (select count(*)::int from visited) as airports`,
    [userId],
  );

  return {
    flights: flightCount,
    flown: stats.flights as number,
    trips,
    countries: stats.countries as number,
    airports: stats.airports as number,
  };
}

/**
 * Local wall time is the source truth; UTC is what orders flights and measures
 * durations, so it is derived here — *after* the insert, which is the whole
 * point. The equivalent statements used to run before the merge, against the
 * previous run's rows, and the delete then threw the result away: every fresh
 * import left dep_utc and arr_utc null, and the reveal quietly fell back to a
 * distance estimate for every flight.
 */
async function deriveUtc(pool: Queryable, userId: string): Promise<void> {
  await pool.query(
    `update flights set dep_utc = (dep_local at time zone dep_tz)
     where user_id=$1 and dep_local is not null and dep_tz is not null`, [userId]);
  await pool.query(
    `update flights set arr_utc = (arr_local at time zone arr_tz)
     where user_id=$1 and arr_local is not null and arr_tz is not null`, [userId]);
  // An arrival "before" departure is the ordinary overnight case: roll it a day.
  await pool.query(
    `update flights set arr_utc = arr_utc + interval '1 day'
     where user_id=$1 and arr_utc is not null and dep_utc is not null and arr_utc <= dep_utc`,
    [userId]);
  // Anything still implausibly long is a bad extraction, not a long flight.
  // Absence is information: record it as unknown rather than publish a guess.
  await pool.query(
    `update flights set arr_utc = null
     where user_id=$1 and arr_utc is not null and dep_utc is not null and distance_km is not null
       and extract(epoch from (arr_utc - dep_utc)) / 3600.0 > 2.0 * (distance_km / 800.0 + 0.5)`,
    [userId]);
}

/**
 * Per-year home airport, then chains of legs that leave home and come back.
 * Fully deterministic: where it can't tell, it says so on the flight rather
 * than guessing a trip into existence.
 */
async function reconstructTrips(pool: Queryable, userId: string, legs: Leg[]): Promise<number> {
  await pool.query(`delete from trips where user_id=$1`, [userId]);
  const ordered = [...legs].sort((a, b) => a.date.localeCompare(b.date));

  const byYear = new Map<string, Leg[]>();
  for (const f of ordered) {
    const y = f.date.slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(f);
  }

  const dayDiff = (a: string, b: string) =>
    Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;

  let tripCount = 0;
  for (const [, yearFlights] of byYear) {
    // Home is where you leave from most often that year — it moves, so it is
    // recomputed per year rather than set once.
    const originCounts = new Map<string, number>();
    for (const f of yearFlights) originCounts.set(f.origin, (originCounts.get(f.origin) ?? 0) + 1);
    const home = [...originCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    let chain: Leg[] = [];
    const flush = async () => {
      if (chain.length === 0) return;
      const closes = chain[chain.length - 1]!.dest === home;
      if (chain[0]!.origin === home && closes && chain.length >= 2) {
        const title = [chain[0]!.origin, ...chain.map((c) => c.dest)].join(" → ");
        const { rows: [t] } = await pool.query(
          `insert into trips (user_id, title, start_date, end_date) values ($1,$2,$3,$4) returning id`,
          [userId, title, chain[0]!.date, chain[chain.length - 1]!.date],
        );
        for (const c of chain) await pool.query(`update flights set trip_id=$2 where id=$1`, [c.id, t.id]);
        tripCount += 1;
      } else {
        for (const c of chain)
          await pool.query(
            `update flights set needs_review=true, review_reason=$2 where id=$1`,
            [c.id, chain.length === 1
              ? "No connecting or return leg found — we didn't guess."
              : "Chain doesn't start and end at your home airport — we didn't guess."],
          );
      }
      chain = [];
    };

    for (const f of yearFlights) {
      const prev = chain[chain.length - 1];
      if (prev && (prev.dest !== f.origin || dayDiff(prev.date, f.date) > TRIP_CHAIN_MAX_GAP_DAYS)) {
        await flush();
      }
      chain.push(f);
      if (f.dest === home && chain.length >= 2) await flush();
    }
    await flush();
  }
  return tripCount;
}
