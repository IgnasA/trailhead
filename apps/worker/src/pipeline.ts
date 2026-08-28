// The import pipeline (pipeline + trip tickets): stage-by-stage over a job
// row that IS the state machine. Per-item failures never abort the job.
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import pg from "pg";
import {
  EXTRACTION_VERSION,
  GMAIL_SEARCH_QUERY,
  TRIP_CHAIN_MAX_GAP_DAYS,
  computeConfidence,
  extractSchemaOrgFlights,
  haversineKm,
  isLikelyFlightEmail,
  mergeKey,
  type FlightExtraction,
} from "@trailhead/domain";
import { fetchEmail, listAllMessageIds, refreshAccessToken } from "./gmail.js";
import { llmExtract } from "./llm.js";
import { sendCompletionEmail } from "./email.js";

const execFileP = promisify(execFile);
const BATCH_SIZE = 200;
const LLM_CALL_CAP = 300; // pipeline ticket: ~$1 ceiling, degrade to failures
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
    `select gmail_message_id from source_emails where user_id=$1`,
    [job.user_id],
  );
  const cached = new Set(cachedRows.map((r) => r.gmail_message_id as string));
  const todo = allIds.filter((id) => !cached.has(id));
  counters.cached_skipped = allIds.length - todo.length;
  await update("skip_cached", {}, true);

  // ── extract (batched; resume via cursor.offset) ───────────────────────────
  const startOffset = Number(job.cursor["offset"] ?? 0);
  const batchTotal = Math.max(1, Math.ceil(todo.length / BATCH_SIZE));
  counters.processed = counters.processed ?? 0;
  counters.flights_found = counters.flights_found ?? 0;
  counters.llm_calls = counters.llm_calls ?? 0;
  const kitineraryBin = process.env.KITINERARY_BIN;

  for (let offset = startOffset; offset < todo.length; offset += BATCH_SIZE) {
    const batch = todo.slice(offset, offset + BATCH_SIZE);
    const batchNo = Math.floor(offset / BATCH_SIZE) + 1;
    await pool.query(`update import_jobs set batch_current=$2, batch_total=$3 where id=$1`, [
      job.id, batchNo, batchTotal,
    ]);
    for (const gmailId of batch) {
      try {
        const email = await fetchEmail(accessToken, gmailId);
        const bodyForHash = email.html || email.text || email.subject;
        const hash = createHash("sha256").update(bodyForHash).digest("hex");

        let extractions: FlightExtraction[] = [];
        let tier: "schema_org" | "kitinerary" | "llm" | null = null;

        extractions = extractSchemaOrgFlights(email.html);
        if (extractions.length > 0) tier = "schema_org";

        if (!tier && kitineraryBin && email.html) {
          try {
            const { stdout } = await execFileP(kitineraryBin, [], {
              maxBuffer: 4 * 1024 * 1024,
              timeout: 20000,
              // kitinerary reads the document from stdin
              ...({ input: email.html } as object),
            } as never);
            extractions = extractSchemaOrgFlights(
              `<script type="application/ld+json">${stdout}</script>`,
            );
            if (extractions.length > 0) tier = "kitinerary";
          } catch {
            // kitinerary miss/crash on one email is not a failure — fall through
          }
        }

        if (!tier && isLikelyFlightEmail(email.subject, email.from)) {
          if (counters.llm_calls >= LLM_CALL_CAP) {
            await fail(gmailId, "llm_budget_exhausted");
          } else {
            counters.llm_calls += 1;
            const result = await llmExtract(
              email.subject, email.from, email.text || email.html,
            );
            if (result?.isFlightEmail && result.originIata && result.destIata && result.departureDate) {
              extractions = [result];
              tier = "llm";
            } else if (result && !result.isFlightEmail) {
              // negative result is cached via source_emails below — never re-asked
            } else if (!result) {
              await fail(gmailId, "llm_parse_failed");
            }
          }
        }

        const emailType = extractions[0]?.emailType ?? "unknown";
        const { rows: [src] } = await pool.query(
          `insert into source_emails (user_id, gmail_message_id, subject, content_hash, email_type, received_at)
           values ($1,$2,$3,$4,$5,$6)
           on conflict (user_id, gmail_message_id) do update set content_hash=excluded.content_hash
           returning id`,
          [job.user_id, gmailId, email.subject.slice(0, 500), hash, emailType, email.receivedAt],
        );
        if (tier) {
          for (const ex of extractions) {
            await pool.query(
              `insert into email_extractions (user_id, source_email_id, extraction_version, tier, payload, confidence)
               values ($1,$2,$3,$4,$5,$6)
               on conflict (source_email_id, extraction_version) do nothing`,
              [job.user_id, src.id, EXTRACTION_VERSION, tier, JSON.stringify(ex), 0.5],
            );
          }
          counters.flights_found += extractions.length;
        }
        counters.processed += 1;
        await update("extract");
      } catch (err) {
        await fail(gmailId, err instanceof Error && /gmail/.test(err.message) ? "gmail_fetch_failed" : "processing_error");
        counters.processed += 1;
      }
    }
    await update("extract", { offset: offset + BATCH_SIZE }, true);
  }

  // ── deduplicate / merge (rebuild canonical flights from all extractions) ──
  await update("deduplicate", {}, true);
  const { rows: extractionRows } = await pool.query(
    `select e.id, e.tier, e.payload from email_extractions e where e.user_id=$1 and e.extraction_version=$2`,
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
      // richer field wins; confirmation-type sources take precedence implicitly
      for (const k of Object.keys(ex) as (keyof FlightExtraction)[]) {
        if (g.ex[k] == null && ex[k] != null) (g.ex as Record<string, unknown>)[k] = ex[k];
      }
    } else {
      groups.set(key, { ids: [row.id], tiers: [row.tier], ex: { ...ex } });
    }
  }

  const { rows: airportRows } = await pool.query(`select iata, lat, lon, tz from airports`);
  const airports = new Map(airportRows.map((a) => [a.iata as string, a]));

  await pool.query(`delete from flights where user_id=$1`, [job.user_id]); // corrections replay lands with M3
  counters.flights = 0;
  const today = new Date().toISOString().slice(0, 10);
  const flightIds: { id: string; date: string; origin: string; dest: string }[] = [];
  for (const { ids, tiers, ex } of groups.values()) {
    const origin = airports.get(ex.originIata!);
    const dest = airports.get(ex.destIata!);
    if (!origin || !dest) continue; // unknown airport → stays extraction-only
    const bestTier = tiers.includes("schema_org") ? "schema_org" : tiers.includes("kitinerary") ? "kitinerary" : "llm";
    const confidence = computeConfidence(bestTier, ex, {
      originKnown: true, destKnown: true, corroboratingEmails: ids.length - 1,
    });
    const depLocal = ex.depLocalTime ? `${ex.departureDate} ${ex.depLocalTime}` : null;
    const arrLocal = ex.arrLocalTime ? `${ex.departureDate} ${ex.arrLocalTime}` : null;
    const { rows: [f] } = await pool.query(
      `insert into flights (user_id, status, airline_iata, flight_number, origin_iata, dest_iata,
         departure_date, dep_local, dep_tz, arr_local, arr_tz, distance_km, booking_ref,
         price_amount, price_currency, confidence, extraction_version)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id`,
      [
        job.user_id,
        ex.departureDate! <= today ? "flown" : "upcoming",
        ex.airlineIata, ex.flightNumber, ex.originIata, ex.destIata,
        ex.departureDate, depLocal, origin.tz, arrLocal, dest.tz,
        haversineKm(origin.lat, origin.lon, dest.lat, dest.lon),
        ex.bookingRef, ex.priceAmount, ex.priceCurrency,
        confidence, EXTRACTION_VERSION,
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

  // ── reconstruct_trips (trip ticket: per-year home, 21-day chaining) ───────
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
    for (const f of yearFlights)
      originCounts.set(f.origin, (originCounts.get(f.origin) ?? 0) + 1);
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
        for (const c of chain)
          await pool.query(`update flights set trip_id=$2 where id=$1`, [c.id, t.id]);
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
