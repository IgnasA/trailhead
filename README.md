# Trailhead

Connect Gmail and see everywhere you've ever travelled.

Trailhead reconstructs your flight history from the booking confirmations,
receipts and check-in emails already sitting in your mailbox — no manual
entry — and presents it as trips, statistics and a route map.

It reads flight emails and nothing else. Extracted flight records, message
ids, subject lines and a hash are stored; **email bodies never are.** When you
open a flight's source email it is fetched live from Gmail and discarded when
you close it. See [docs/privacy.md](docs/privacy.md), which is generated from
the same source the app renders.

---

## Status

The MVP is built and runs against a real mailbox: 740 candidate emails →
102 flights, 12 trips, 30 countries, 243,891 km. Not launched — the Google
OAuth consent screen is in testing mode, which caps it at 100 named users.

| Milestone | What it covers | State |
|---|---|---|
| M0 | Monorepo, schema, reference data, CI | Done |
| M1 | Landing, permission screen, Gmail connect | Done |
| M2 | Import pipeline, live progress, failure list | Done |
| M3 | Dashboard: overview, trips, flight detail with provenance | Done |
| M4 | Monochrome MapLibre map, landing teaser | Done |
| M5 | The three-stop reveal, save as image | Done |
| M6 | Settings, the deletion actions, corrections | Done |

Known gaps are recorded honestly in the tickets rather than hidden: user
corrections are stored but not yet replayed over a re-import, the golden-corpus
eval harness is specified but unbuilt, and three extraction-quality bugs
(a wrong-but-real airport code, codeshare duplicates, cancellations merging
into flown flights) are captured as eval cases in
[tracker/tickets/018](tracker/tickets/018-m3-dashboard.md).

## How it works

```
Gmail search  →  skip already-read (content hash)
              →  schema.org FlightReservation parser      (deterministic)
              →  pre-filter: flight number or route?      (deterministic)
              →  Claude Haiku, one Message Batch          (only what's left)
              →  merge on (airline, flight no, date, route)
              →  trips: per-year home airport, 21-day chaining
```

Every flight keeps its provenance — which emails it came from, which
extraction version, what confidence — and absent fields read "not found in
source" rather than being guessed. Trip reconstruction declines to guess too:
a flight it can't confidently place is surfaced for review with the reason.

Aggregations are plain SQL. No LLM is involved in counting anything.

## Repository layout

| Path | What's in it |
|---|---|
| `apps/web` | Next.js app (App Router, TypeScript) |
| `apps/worker` | The import worker: Gmail → extraction → merge → trips |
| `packages/domain` | Types, extraction contract, deterministic rules, tests |
| `packages/gmail` | Minimal Gmail REST client shared by both apps |
| `supabase/migrations` | Schema and functions, in order |
| `design/` | The imported wireframes and the Modernist design system |
| `docs/` | The product brief, ADRs, schema, privacy, research findings |
| `tracker/` | The wayfinder map and its tickets — how every decision was made |

## Running it

Requires Node 22+, pnpm, a Supabase project, a Google OAuth client with
`gmail.readonly`, and an Anthropic API key.

```bash
pnpm install
pnpm vendor:reference-data          # airports + airlines into packages/domain/data
node --env-file=.env.local scripts/seed-reference-data.mjs
pnpm dev                            # web app on :3000
```

The worker runs separately and polls for queued import jobs:

```bash
pnpm --filter @trailhead/worker start
```

`scripts/setup-google-oauth.sh` walks the Google Cloud and Supabase Auth setup
step by step. Environment variables live in `.env.local` (git-ignored):
`DATABASE_URL`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
`ANTHROPIC_API_KEY`, and for the web app `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Cost

A first import of a 740-email mailbox measured **$1.54** in tokens before
tuning. Three changes since — an evidence-based pre-filter, the Batch API at
half price, and a smaller body cap — should bring that to roughly $0.20–0.30;
that figure is not yet verified on a fresh mailbox. Re-imports are effectively
free: already-read emails are skipped by content hash.

## Decisions

`tracker/map.md` is the index of every decision and why it was made, each one
linked to the ticket that settled it. [`docs/adr/0001-stack.md`](docs/adr/0001-stack.md)
covers the architecture; [`CONTEXT.md`](CONTEXT.md) is the domain glossary;
[`docs/brief.md`](docs/brief.md) is the original product brief the wireframes
were drawn from.
