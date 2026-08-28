---
title: Build plan
label: wayfinder:grilling
status: closed
assignee: Ignas + Claude (this session)
blocked-by: []
---

## Question

Every decision the build waited on is closed (stack, schema, Gmail, extraction
pipeline, trips, privacy, reference data, basemap). Graduated from the fog:
decide the milestone ordering and slice the MVP into build tickets — which
frames ship in what order, what gates what, and where the risky spikes sit
(kitinerary sidecar, combined OAuth flow). Absorbs the remaining fog patches:
empty states / settings screens, "Save as image", and the hi-fi pass
sequencing relative to the reveal prototype.

## Resolution

One grilling round, all recommendations accepted. The milestones, each
becoming build tickets (children of the map, worked one per session, PRs on
this repo) when reached:

- **M0 — Scaffold**: pnpm monorepo (`apps/web`, `apps/worker`,
  `packages/domain`), Next.js shell, fresh Supabase project +
  `docs/schema.sql` as migration 0001, reference-data vendoring script, CI,
  Fly worker deploy pipeline.
- **M1 — Auth & connect**: landing (1a, static teaser placeholder),
  permissions screen (1b), combined Google OAuth with `gmail.readonly`,
  Vault custody. Gated by [Google Cloud OAuth setup](013-google-cloud-oauth-setup.md).
- **M2 — Import pipeline**: worker stages end-to-end (schema.org tier +
  pre-filter + sync Haiku), progress page (1c) on Realtime, failure list,
  completion email. Opens with the kitinerary spike (decides the Docker
  story).
- **M3 — Dashboard data views**: overview (1e), trips (1g), flight detail +
  provenance + live source fetch (1h), mobile dashboard (1j).
- **M4 — Map**: monochrome MapLibre component, map tab (1f), landing teaser
  static render.
- **M5 — Reveal**: three-stop scroll story (1d/1i) + "Save as image";
  shaped by the [Reveal scroll story prototype](012-reveal-scroll-story-prototype.md).
- **M6 — Settings & polish**: disconnect/delete per the privacy model,
  `docs/privacy.md` single-source copy, empty states, hi-fi sweep.

Gates: dogfooding starts after M2; no test user other than the owner sees
the product before M5 exists. The absorbed fog patches (empty states,
save-as-image, hi-fi sequencing) live inside M5/M6.
