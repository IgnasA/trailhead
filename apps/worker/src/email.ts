// Completion email via Resend ("We'll email you when it's done"). Degrades
// to a log line when RESEND_API_KEY is unset. No email content in logs.
import type pg from "pg";

export async function sendCompletionEmail(
  pool: pg.Pool,
  userId: string,
  counters: Record<string, number>,
): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const { rows: [conn] } = await pool.query(
    `select email_address from gmail_connections where user_id=$1 and status='connected' limit 1`,
    [userId],
  );
  if (!conn) return;
  if (!key) {
    console.log(`worker: completion email skipped (no RESEND_API_KEY) for user ${userId}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? "Trailhead <onboarding@resend.dev>",
      to: [conn.email_address],
      subject: "Your travel history is ready",
      text: [
        "Your import finished.",
        "",
        `${counters.total_flights ?? 0} flights across ${counters.total_countries ?? 0} countries.`,
        "",
        `Open your history: ${process.env.APP_URL ?? "http://localhost:3000"}/import`,
      ].join("\n"),
    }),
  });
  if (!res.ok) throw new Error(`resend: ${res.status}`);
}
