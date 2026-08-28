---
title: Stack and hosting decision
label: wayfinder:grilling
status: open
assignee:
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
