---
title: Stack and hosting decision
label: wayfinder:grilling
status: closed
assignee: Ignas + Claude (this session)
blocked-by: []
---

## Question

What is the stack? Frontend framework, backend/runtime, database, background
job mechanism, and where it deploys. The wireframes constrain the answer more
than usual:

- OAuth with Google and a server-side Gmail import pipeline (long-running,
  resumable, batched — frame 1c shows "Import job #4812 · batch 3 of 7" and
  "You can close this tab").
- Live-ish progress on the import screen (counters tick up; page is "a view of
  job state, not the job itself").
- MapLibre GL on the dashboard; a static map teaser asset on the landing page
  (explicitly *not* a live map instance — cost, LCP).
- Dashboard filters live in the URL ("a URL param, not a store").
- Mobile web (frames 1i/1j are responsive web, not native).

Context to confirm, not assume: Supabase MCP tooling is connected in this
project's Claude setup, which suggests Supabase (Postgres + auth + edge
functions) is the intended backend. Grill on: is that the intent? What pairs
with it for the frontend (Next.js? Remix? plain Vite SPA?), where do
long-running import jobs run (Supabase edge functions have tight limits), and
what's the deploy target?

## Resolution

Grilled over three rounds, every recommendation accepted. Full record:
[docs/adr/0001-stack.md](../../docs/adr/0001-stack.md).

- **Web**: Next.js (App Router) + TypeScript on Vercel (Hobby while
  dogfooding, Pro at launch).
- **Backend**: fresh Supabase project, `eu-central-1` (the paused
  `flight-scanner` project is mined for parts only). Supabase Auth Google
  provider with `gmail.readonly` in the same consent — sign-up and
  Gmail-connect are one gesture, matching frames 1a/1b; RLS on all user data.
- **Import worker**: one always-on Fly.io container (`fra`/`ams`), Node/TS +
  the kitinerary binary in the image. No queue library — `import_jobs` table
  as the job state machine, `FOR UPDATE SKIP LOCKED`, cursor-based resume.
- **Progress**: Supabase Realtime on the job row, polling fallback.
- **Token custody**: Supabase Vault, service-role-only access.
- **Email**: Resend. **Observability**: Sentry + a standing no-content
  logging rule (Limited Use). **CI**: GitHub Actions; Vercel auto-deploy,
  Action-deploy for the worker.
- **Repo**: pnpm workspace — `apps/web`, `apps/worker`, `packages/domain`.

Budget: ~$25/mo ceiling holds (worker ~$3-5/mo is the only always-on cost
until Vercel Pro at launch).
