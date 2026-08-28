---
title: M0 scaffold
label: wayfinder:task
status: closed
assignee: Ignas + Claude (this session)
blocked-by: []
---

## Question

Build milestone M0 from the [Build plan](014-build-plan.md): pnpm monorepo
(`apps/web`, `apps/worker`, `packages/domain`), Next.js shell, the schema
(docs/schema.sql) applied as migration 0001 to Supabase project
`giylqxatradpvsytpery`, the reference-data vendoring script, CI (typecheck +
tests on PR), and the Fly worker deploy pipeline (stub until a Fly app
exists).

Also resolves the styling fog item at scaffold time: the Modernist design
system's own `styles.css` is the design authority — vendor it as the base
stylesheet, plain CSS, no Tailwind/shadcn (the brief's §6 suggestion loses to
the design authority; recorded in ticket 001's deltas).

## Resolution

Built and verified:

- **Monorepo**: pnpm workspace — `packages/domain` (types, Zod extraction
  contract, deterministic constants, Haversine + 4 passing tests),
  `apps/web` (Next.js 15 App Router, vendored Modernist stylesheet as the
  base CSS — no Tailwind/shadcn, resolving the styling fog item),
  `apps/worker` (SKIP LOCKED claim loop stub, Dockerfile, fly.toml).
  `pnpm typecheck` and `pnpm test` pass across the workspace.
- **Database**: migrations 0001 (full schema) and 0002 (reference tables
  world-read-only) applied to Supabase project `giylqxatradpvsytpery` — all
  11 tables live, RLS everywhere, verified via list_tables.
- **Reference data**: `pnpm vendor:reference-data` works — 9,054 IATA
  airports with vendor-time IANA timezones + 993 active airlines
  (seed + overlay), generated into `packages/domain/data/` (git-ignored).
- **CI**: typecheck + tests on PR/main; worker deploy workflow is
  manual-dispatch until a Fly app exists.

Leftovers (blocked on credentials only the user holds; first slices of M1/M2):

1. **Fly app**: done — `trailhead-worker` (fra) created by the user via
   `fly launch`; deploy workflow flipped to push-on-main (worker paths).
   User adds `FLY_API_TOKEN` via `gh secret set` directly.
2. **Seed the airports/airlines tables**: done — `scripts/seed-reference-data.mjs`
   (idempotent upsert) loaded 9,054 airports and 993 airlines; verified by
   live count (VNO -> Europe/Vilnius, FR -> Ryanair). Re-run after
   `pnpm vendor:reference-data` to refresh.
