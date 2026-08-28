// The import pipeline (pipeline + trip tickets): stage-by-stage over a job
// row that IS the state machine. Per-item failures never abort the job.
//
// Extraction runs in two passes. The first fetches every candidate and tries
// the deterministic tier; the second sends whatever is left to the LLM — as
// one Message Batch (half price) when there are enough of them, or
// synchronously for a handful, where batch turnaround isn't worth the wait.
import { createHash } from "node:crypto";
import pg from "pg";
import {
  EXTRACTION_VERSION,
  GMAIL_SEARCH_QUERY,
  TRIP_CHAIN_MAX_GAP_DAYS,
  bodyForExtraction,
  computeConfidence,
  extractSchemaOrgFlights,
  haversineKm,
  isLikelyFlightEmail,
  mergeKey,
  normalizeFlightNumber,
  type FlightExtraction,
} from "@trailhead/domain";
import { fetchEmail, listAllMessageIds, refreshAccessToken } from "@trailhead/gmail";
import {
  LlmUnavailableError, collectBatch, llmExtract, submitBatch, type BatchItem,
} from "./llm.js";
import { sendCompletionEmail } from "./email.js";

const LLM_CALL_CAP = Number(process.env.LLM_CALL_CAP ?? 800);
/** Below this many candidates, batching costs more waiting than it saves. */
const BATCH_MIN = Number(process.env.LLM_BATCH_MIN ?? 20);
const BATCH_POLL_MS = 15_000;
const BATCH_MAX_WAIT_MS = Number(process.env.LLM_BATCH_MAX_WAIT_MS ?? 3_600_000);
const FETCH_CHUNK = 200;

const STAGES = [
  "connect", "search", "skip_cached", "extract",
  "deduplicate", "reconstruct_trips", "build_history",
] as const;

interface Job {
  id: string;
  user_id: string;
  counters: Record<string, number>;
  cursor: Record<string, unknown>;
}

/** An email awaiting the LLM: deliberately kept out of the skip-cache until
 *  its verdict lands, so an interrupted job retries exactly these. */
interface Pending extends BatchItem {
  hash: string;
  receivedAt: string | null;
}

export async function runJob(pool: pg.Pool, job: Job): Promise<void> {
  const counters: Record<string, number> = { ...job.counters };
  let lastWrite = 0;
  const update = async (stage: (typeof STAGES)[number], extra: object = {}, force = false) => {
    const now = Date.now();
    if (!force && now - lastWrite < 1000) return; // ≤1 write/sec (pipeline ticket)
    lastWrite = now;
    await pool.query(
      `update import_jobs set stage=$2, counters=$3, cursor=cursor||$4::jsonb, updated_at=now() where id=$1`,
      [job.id, stage, JSON.stringify(counters), JSON.stringify(extra)],
    );
  };
  const fail = async (gmailId: string, reason: string) => {
    counters.failures = (counters.failures ?? 0) + 1;
    await pool.query(
      `insert into import_failures (job_id, user_id, gmail_message_id, reason) values ($1,$2,$3,$4)`,
      [job.id, job.user_id, gmailId, reason], // reasons are categorical — never email text
    );
  };
  const cacheEmail = async (
    gmailId: string, subject: string, hash: string, emailType: string, receivedAt: string | null,
  ): Promise<string> => {
    const { rows: [src] } = await pool.query(
      `insert into source_emails (user_id, gmail_message_id, subject, content_hash, email_type, received_at)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (user_id, gmail_message_id) do update set content_hash=excluded.content_hash
       returning id`,
      [job.user_id, gmailId, subject.slice(0, 500), hash, emailType, receivedAt],
    );
    return src.id as string;
  };
  const storeExtractions = async (sourceId: string, tier: string, extractions: FlightExtraction[]) => {
    for (const [segmentIndex, ex] of extractions.entries()) {
      await pool.query(
        `insert into email_extractions (user_id, source_email_id, extraction_version, segment_index, tier, payload, confidence)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (source_email_id, extraction_version, segment_index) do nothing`,
        [job.user_id, sourceId, EXTRACTION_VERSION, segmentIndex, tier, JSON.stringify(ex), 0.5],
      );
    }
    counters.flights_found = (counters.flights_found ?? 0) + extractions.length;
  };

  // A retry of the same job starts a fresh failure list.
  await pool.query(`delete from import_failures where job_id=$1`, [job.id]);

  // ── connect ───────────────────────────────────────────────────────────────
  await update("connect", {}, true);
  const { rows: [secret] } = await pool.query(
    `select decrypted_secret from vault.decrypted_secrets where name = 'gmail_refresh:' || $1::text`,
    [job.user_id],
  );
  if (!secret) throw new Error("no refresh token in vault");
  const accessToken = await refreshAccessToken(secret.decrypted_secret);
  counters.connected = 1;

  // ── search ────────────────────────────────────────────────────────────────
  await update("search", {}, true);
  const allIds = await listAllMessageIds(accessToken, GMAIL_SEARCH_QUERY);
  counters.candidates = allIds.length;
  await update("search", {}, true);

  // ── skip_cached ───────────────────────────────────────────────────────────
  await update("skip_cached", {}, true);
  const { rows: cachedRows } = await pool.query(
    `select gmail_message_id from source_emails where user_id=$1`, [job.user_id],
  );
  const cached = new Set(cachedRows.map((r) => r.gmail_message_id as string));
  const todo = allIds.filter((id) => !cached.has(id));
  counters.cached_skipped = allIds.length - todo.length;
  await update("skip_cached", {}, true);

  // ── extract, pass 1: fetch + deterministic tier + pre-filter ──────────────
  counters.processed = counters.processed ?? 0;
  counters.flights_found = counters.flights_found ?? 0;
  counters.llm_calls = counters.llm_calls ?? 0;
  const pending: Pending[] = [];
  const chunkTotal = Math.max(1, Math.ceil(todo.length / FETCH_CHUNK));

  for (const [index, gmailId] of todo.entries()) {
    if (index % FETCH_CHUNK === 0) {
      await pool.query(`update import_jobs set batch_current=$2, batch_total=$3 where id=$1`, [
        job.id, Math.floor(index / FETCH_CHUNK) + 1, chunkTotal,
      ]);
    }
    try {
      const email = await fetchEmail(accessToken, gmailId);
      const body = bodyForExtraction(email.text, email.html);
      const hash = createHash("sha256").update(email.html || email.text || email.subject).digest("hex");

      const schemaOrg = extractSchemaOrgFlights(email.html);
      if (schemaOrg.length > 0) {
        const sourceId = await cacheEmail(gmailId, email.subject, hash, schemaOrg[0]!.emailType, email.receivedAt);
        await storeExtractions(sourceId, "schema_org", schemaOrg);
      } else if (isLikelyFlightEmail({ subject: email.subject, from: email.from, body })) {
        pending.push({ id: gmailId, subject: email.subject, from: email.from, body, hash, receivedAt: email.receivedAt });
      } else {
        // A confident deterministic "not a flight": cache it so it is never
        // paid for again. This is the pre-filter's whole purpose.
        await cacheEmail(gmailId, email.subject, hash, "unknown", email.receivedAt);
        counters.prefiltered = (counters.prefiltered ?? 0) + 1;
      }
      counters.processed += 1;
      await update("extract");
    } catch (err) {
      await fail(gmailId, err instanceof Error && /gmail/.test(err.message) ? "gmail_fetch_failed" : "processing_error");
      counters.processed += 1;
    }
  }
  counters.llm_candidates = pending.length;
  await update("extract", {}, true);

  // ── extract, pass 2: the LLM tier ─────────────────────────────────────────
  const capped = pending.slice(0, LLM_CALL_CAP);
  for (const over of pending.slice(LLM_CALL_CAP)) await fail(over.id, "llm_budget_exhausted");

  const applyResult = async (item: Pending, extractions: FlightExtraction[]) => {
    const usable = extractions.filter((e) => e.originIata && e.destIata && e.departureDate);
    const sourceId = await cacheEmail(
      item.id, item.subject, item.hash, usable[0]?.emailType ?? "unknown", item.receivedAt,
    );
    if (usable.length > 0) await storeExtractions(sourceId, "llm", usable);
  };

  if (capped.length > 0) {
    try {
      if (capped.length >= BATCH_MIN) {
        // Half price, at the cost of turnaround — the progress page says so.
        let batchId = (job.cursor["batch_id"] as string | null | undefined) ?? null;
        if (!batchId) {
          batchId = await submitBatch(capped);
          await update("extract", { batch_id: batchId }, true);
        }
        counters.batch_waiting = 1;
        counters.llm_calls += capped.length;
        await update("extract", {}, true);

        const deadline = Date.now() + BATCH_MAX_WAIT_MS;
        let outcome = await collectBatch(batchId);
        while (!outcome && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, BATCH_POLL_MS));
          await update("extract", {}, true); // heartbeat
          outcome = await collectBatch(batchId);
        }
        counters.batch_waiting = 0;
        if (!outcome) throw new Error("extraction batch did not finish in time");

        counters.llm_input_tokens = (counters.llm_input_tokens ?? 0) + outcome.inputTokens;
        counters.llm_output_tokens = (counters.llm_output_tokens ?? 0) + outcome.outputTokens;
        for (const item of capped) {
          const extractions = outcome.results.get(item.id);
          if (extractions) await applyResult(item, extractions);
          else await fail(item.id, "llm_parse_failed"); // uncached — retried next run
        }
        await update("extract", { batch_id: null }, true);
      } else {
        for (const item of capped) {
          counters.llm_calls += 1;
          const result = await llmExtract(item.subject, item.from, item.body);
          if (!result) {
            await fail(item.id, "llm_parse_failed");
            continue;
          }
          counters.llm_input_tokens = (counters.llm_input_tokens ?? 0) + result.inputTokens;
          counters.llm_output_tokens = (counters.llm_output_tokens ?? 0) + result.outputTokens;
          await applyResult(item, result.extractions);
          await update("extract");
        }
      }
    } catch (err) {
      if (err instanceof LlmUnavailableError) {
        // Systemic: mark the import degraded and carry on with what the
        // deterministic tier found. Nothing pending is cached, so a re-run
        // retries exactly those emails.
        counters.extraction_degraded = 1;
        counters.batch_waiting = 0;
        console.error(`worker: LLM tier disabled for this job (${err.code}) — continuing deterministic-only`);
        for (const item of capped) await fail(item.id, "llm_unavailable");
      } else {
        throw err;
      }
    }
  }
  await update("extract", {}, true);

  // Derive UTC from local wall times and airport zones (migrations 0008/0009).
  await pool.query(
    `update flights set dep_utc = (dep_local at time zone dep_tz)
     where user_id=$1 and dep_local is not null and dep_tz is not null`, [job.user_id]);
  await pool.query(
    `update flights set arr_utc = (arr_local at time zone arr_tz)
     where user_id=$1 and arr_local is not null and arr_tz is not null`, [job.user_id]);
  await pool.query(
    `update flights set arr_utc = arr_utc + interval '1 day'
     where user_id=$1 and arr_utc is not null and dep_utc is not null and arr_utc <= dep_utc`, [job.user_id]);
  await pool.query(
    `update flights set arr_utc = null
     where user_id=$1 and arr_utc is not null and dep_utc is not null and distance_km is not null
       and extract(epoch from (arr_utc - dep_utc)) / 3600.0 > 2.0 * (distance_km / 800.0 + 0.5)`,
    [job.user_id]);

  // ── deduplicate / merge ───────────────────────────────────────────────────
  await update("deduplicate", {}, true);
  const { rows: extractionRows } = await pool.query(
    `select id, tier, payload from email_extractions where user_id=$1 and extraction_version=$2`,
    [job.user_id, EXTRACTION_VERSION],
  );
  const groups = new Map<string, { ids: string[]; tiers: string[]; ex: FlightExtraction }>();
  for (const row of extractionRows) {
    const ex = row.payload as FlightExtraction;
    if (!ex.originIata || !ex.destIata || !ex.departureDate) continue;
    const key = mergeKey(ex);
    const g = groups.get(key);
    if (g) {
      g.ids.push(row.id);
      g.tiers.push(row.tier);
      for (const k of Object.keys(ex) as (keyof FlightExtraction)[]) {
        if (g.ex[k] == null && ex[k] != null) (g.ex as Record<string, unknown>)[k] = ex[k];
      }
    } else {
      groups.set(key, { ids: [row.id], tiers: [row.tier], ex: { ...ex } });
    }
  }

  const { rows: airportRows } = await pool.query(`select iata, lat, lon, tz from airports`);
  const airports = new Map(airportRows.map((a) => [a.iata as string, a]));

  await pool.query(`delete from flights where user_id=$1`, [job.user_id]);
  counters.flights = 0;
  const today = new Date().toISOString().slice(0, 10);
  const flightIds: { id: string; date: string; origin: string; dest: string }[] = [];
  for (const { ids, tiers, ex } of groups.values()) {
    const origin = airports.get(ex.originIata!);
    const dest = airports.get(ex.destIata!);
    if (!origin || !dest) continue;
    const bestTier = tiers.includes("schema_org") ? "schema_org" : tiers.includes("kitinerary") ? "kitinerary" : "llm";
    const confidence = computeConfidence(bestTier, ex, {
      originKnown: true, destKnown: true, corroboratingEmails: ids.length - 1,
    });
    const depLocal = ex.depLocalTime ? `${ex.departureDate} ${ex.depLocalTime}` : null;
    const arrLocal = ex.arrLocalTime ? `${ex.departureDate} ${ex.arrLocalTime}` : null;
    const distanceKm = haversineKm(origin.lat, origin.lon, dest.lat, dest.lon);
    const { rows: [f] } = await pool.query(
      `insert into flights (user_id, status, airline_iata, flight_number, origin_iata, dest_iata,
         departure_date, dep_local, dep_tz, arr_local, arr_tz, distance_km, booking_ref,
         price_amount, price_currency, confidence, extraction_version)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id`,
      [
        job.user_id,
        ex.departureDate! <= today ? "flown" : "upcoming",
        ex.airlineIata, normalizeFlightNumber(ex.flightNumber, ex.airlineIata), ex.originIata, ex.destIata,
        ex.departureDate, depLocal, origin.tz, arrLocal, dest.tz, distanceKm,
        ex.bookingRef, ex.priceAmount, ex.priceCurrency, confidence, EXTRACTION_VERSION,
      ],
    );
    for (const exId of ids) {
      await pool.query(
        `insert into flight_sources (flight_id, extraction_id) values ($1,$2) on conflict do nothing`,
        [f.id, exId],
      );
    }
    counters.flights += 1;
    flightIds.push({ id: f.id, date: ex.departureDate!, origin: ex.originIata!, dest: ex.destIata! });
  }
  await update("deduplicate", {}, true);

  // ── reconstruct_trips (per-year home, 21-day chaining, decline to guess) ──
  await update("reconstruct_trips", {}, true);
  await pool.query(`delete from trips where user_id=$1`, [job.user_id]);
  flightIds.sort((a, b) => a.date.localeCompare(b.date));
  const byYear = new Map<string, typeof flightIds>();
  for (const f of flightIds) {
    const y = f.date.slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(f);
  }
  counters.trips = 0;
  const dayDiff = (a: string, b: string) =>
    Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
  for (const [, yearFlights] of byYear) {
    const originCounts = new Map<string, number>();
    for (const f of yearFlights) originCounts.set(f.origin, (originCounts.get(f.origin) ?? 0) + 1);
    const home = [...originCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    let chain: typeof flightIds = [];
    const flush = async () => {
      if (chain.length === 0) return;
      const closes = chain[chain.length - 1]!.dest === home;
      if (chain[0]!.origin === home && closes && chain.length >= 2) {
        const title = [chain[0]!.origin, ...chain.map((c) => c.dest)].join(" → ");
        const { rows: [t] } = await pool.query(
          `insert into trips (user_id, title, start_date, end_date) values ($1,$2,$3,$4) returning id`,
          [job.user_id, title, chain[0]!.date, chain[chain.length - 1]!.date],
        );
        for (const c of chain) await pool.query(`update flights set trip_id=$2 where id=$1`, [c.id, t.id]);
        counters.trips = (counters.trips ?? 0) + 1;
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
  await update("reconstruct_trips", {}, true);

  // ── build_history ─────────────────────────────────────────────────────────
  await update("build_history", {}, true);
  const { rows: [stats] } = await pool.query(
    `with flown as (select * from flights where user_id=$1 and status='flown'),
          visited as (select origin_iata as iata from flown union select dest_iata from flown)
     select (select count(*)::int from flown) as flights,
            (select count(distinct a.iso_country)::int from visited v join airports a on a.iata=v.iata) as countries,
            (select count(*)::int from visited) as airports`,
    [job.user_id],
  );
  counters.total_flights = stats.flights;
  counters.total_countries = stats.countries;
  counters.total_airports = stats.airports;
  await pool.query(
    `update import_jobs set status='completed', stage='build_history', counters=$2,
       batch_current=batch_total, finished_at=now(), updated_at=now() where id=$1`,
    [job.id, JSON.stringify(counters)],
  );
  await sendCompletionEmail(pool, job.user_id, counters).catch((e) =>
    console.error("completion email failed:", e instanceof Error ? e.message : e),
  );
}
