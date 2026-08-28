// Import worker: claims queued import_jobs and runs the pipeline.
// M0: the claim loop and heartbeat only — pipeline stages land in M2.
import pg from "pg";

const POLL_MS = 5_000;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("worker: DATABASE_URL not set — idling (M0 scaffold mode)");
    setInterval(() => {}, 60_000);
    return;
  }
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  console.log("worker: polling for queued import jobs");
  for (;;) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const { rows } = await client.query(
        `select id, user_id from import_jobs
         where status = 'queued'
         order by created_at
         limit 1
         for update skip locked`,
      );
      const job = rows[0];
      if (job) {
        await client.query(
          `update import_jobs
           set status = 'running', started_at = now(), updated_at = now()
           where id = $1`,
          [job.id],
        );
        await client.query("commit");
        console.log(`worker: claimed job ${job.id} — pipeline arrives in M2; failing it honestly`);
        await pool.query(
          `update import_jobs
           set status = 'failed', finished_at = now(), updated_at = now()
           where id = $1`,
          [job.id],
        );
      } else {
        await client.query("commit");
      }
    } catch (err) {
      await client.query("rollback").catch(() => {});
      console.error("worker: poll error", err instanceof Error ? err.message : err);
    } finally {
      client.release();
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((err) => {
  console.error("worker: fatal", err);
  process.exit(1);
});
