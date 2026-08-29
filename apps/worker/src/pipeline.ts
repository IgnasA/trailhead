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
  bodyForExtraction,
  extractSchemaOrgFlights,
  isLikelyFlightEmail,
  type FlightExtraction,
} from "@trailhead/domain";
import { rebuildHistory } from "@trailhead/history";
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

  // Everything past extraction is deriving the history from what was found.
  // That derivation is shared with the manual-add path, so the invariant it
  // enforces — Flights hold no independent truth — has exactly one definition.
  const built = await rebuildHistory(pool, job.user_id, (s) => update(s, {}, true));
  counters.flights = built.flights;
  counters.trips = built.trips;
  counters.total_flights = built.flown;
  counters.total_countries = built.countries;
  counters.total_airports = built.airports;
  await pool.query(
    `update import_jobs set status='completed', stage='build_history', counters=$2,
       batch_current=batch_total, finished_at=now(), updated_at=now() where id=$1`,
    [job.id, JSON.stringify(counters)],
  );
  await sendCompletionEmail(pool, job.user_id, counters).catch((e) =>
    console.error("completion email failed:", e instanceof Error ? e.message : e),
  );
}
