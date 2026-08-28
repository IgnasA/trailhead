# 1. Stack: serverless web app plus one always-on worker container

Date: 2026-08-28
Status: accepted

## Context

Trailhead's MVP (see `design/MVP Wireframes.dc.html` and `tracker/map.md`)
needs: Google OAuth where sign-up and Gmail-connect are a single gesture; an
import pipeline that runs 4–5 minutes per mailbox scan against Gmail quotas,
is resumable and batched, and surfaces live per-stage counters; MapLibre GL on
the dashboard with a static map teaser on the landing page; mobile web; a
~$25/month ceiling with no ops appetite while the product proves itself.

Two researched constraints shaped this more than anything: the extraction
strategy's deterministic tier is KDE's `kitinerary-extractor` — a C++/Qt CLI
that needs a real container — and Gmail scans exceed serverless function
limits. A pure-serverless stack was a genuine alternative, but only by
dropping the kitinerary tier and chunking jobs into short invocations.

## Decision

- **Web**: Next.js (App Router), TypeScript, on Vercel — Hobby while
  dogfooding in OAuth Testing mode, Pro at launch.
- **Backend**: a fresh Supabase project in `eu-central-1` (Postgres, Auth,
  Realtime, Vault). The old `flight-scanner` project is mined for reusable
  parts only, then left paused.
- **Auth**: Supabase Auth's Google provider, requesting `gmail.readonly` in
  the same consent (`access_type=offline`, `prompt=consent`); RLS keyed to
  `auth.uid()` on all user data.
- **Import worker**: one small always-on Fly.io machine (`fra`/`ams`), a
  Node/TS process in a Docker image that also carries the kitinerary binary.
  No queue library: an `import_jobs` table is the job's full state machine
  (stage, counters, batch cursor, failure list), claimed with
  `FOR UPDATE SKIP LOCKED`; resume = re-claim and continue from the cursor.
- **Progress UI**: Supabase Realtime subscription on the user's job row,
  plain polling as fallback; the worker never talks to browsers.
- **Gmail refresh tokens**: Supabase Vault, readable only via the service
  role the worker uses — never through the API or RLS-visible tables.
- **Email**: Resend (free tier) for the import-completion notification.
- **Observability**: Sentry (web + worker) with PII scrubbing, plus a
  standing no-content logging rule — logs carry ids and counters only, never
  subjects, senders, or extracted field values (Google Limited Use).
- **Repo**: one pnpm workspace — `apps/web`, `apps/worker`,
  `packages/domain`. CI: GitHub Actions (typecheck + tests on PR); Vercel
  auto-deploys web, an Action deploys the worker on merge to main.

## Consequences

- The worker container is the one always-on cost (~$3–5/mo) and the one
  non-serverless moving part; scaling past a single worker later means adding
  machines — the SKIP LOCKED claim already permits it.
- Provider-token refresh is our code, not Supabase's: the worker must handle
  Gmail token refresh and re-consent failures explicitly.
- Vercel Hobby's non-commercial terms mean Pro ($20/mo) the day real users
  arrive, consuming most of the budget ceiling — accepted.
- The stack carries no ODbL-encumbered runtime dependency; reference-data
  licensing decisions live in the reference-data ticket.
