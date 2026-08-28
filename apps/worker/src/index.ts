// Import worker: claims queued import_jobs (FOR UPDATE SKIP LOCKED) and runs
// the pipeline. One job at a time per worker; scaling = more machines.
import pg from "pg";
import { runJob } from "./pipeline.js";

const POLL_MS = 5_000;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("worker: DATABASE_URL not set — idling");
    setInterval(() => {}, 60_000);
    return;
  }
  const pool = new pg.Pool({ connectionString: url, max: 4 });
  console.log("worker: polling for queued import jobs");
  for (;;) {
    const client = await pool.connect();
    let job: { id: string; user_id: string; counters: Record<string, number>; cursor: Record<string, unknown> } | undefined;
    try {
      await client.query("begin");
      const { rows } = await client.query(
        `select id, user_id, counters, cursor from import_jobs
         where status = 'queued' order by created_at limit 1
         for update skip locked`,
      );
      job = rows[0];
      if (job) {
        await client.query(
          `update import_jobs set status='running', started_at=coalesce(started_at, now()), updated_at=now() where id=$1`,
          [job.id],
        );
      }
      await client.query("commit");
    } catch (err) {
      await client.query("rollback").catch(() => {});
      console.error("worker: claim error", err instanceof Error ? err.message : err);
    } finally {
      client.release();
    }

    if (job) {
      console.log(`worker: running job ${job.id}`);
      try {
        await runJob(pool, job);
        console.log(`worker: job ${job.id} completed`);
      } catch (err) {
        console.error(`worker: job ${job.id} failed:`, err instanceof Error ? err.message : err);
        await pool.query(
          `update import_jobs set status='failed', finished_at=now(), updated_at=now(),
             counters = counters || jsonb_build_object('error', $2::text)
           where id=$1`,
          [job.id, err instanceof Error ? err.message.slice(0, 200) : "unknown"],
        ).catch(() => {});
      }
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((err) => {
  console.error("worker: fatal", err);
  process.exit(1);
});
