---
title: M1 auth and connect
label: wayfinder:task
status: closed
assignee: Ignas + Claude (this session)
blocked-by: []
---

## Question

Build milestone M1 from the [Build plan](014-build-plan.md): the real landing
page (frame 1a), the trust screen (1b), and the combined Google sign-in +
Gmail consent flow ending with the refresh token in Vault.

## Progress

Built (branch `m1/auth-and-connect`):

- Landing (1a): nav, headline/sub verbatim from the brief, red CTA, trust row
  (Read-only / ~90 sec / Delete), teaser panel placeholder for M4's static
  render.
- Trust screen (1b) at `/connect`: Step 1 of 2, store/never-store table,
  literal `gmail.readonly` scope string, error states for every failure mode
  of the OAuth round-trip.
- Auth flow: `signInWithOAuth` (Google + gmail.readonly,
  `access_type=offline`, `prompt=consent`) → `/auth/callback` exchanges the
  PKCE code → migration 0003's `store_gmail_connection` definer function
  puts the refresh token in Vault (applied to the live DB) and upserts
  `gmail_connections` → `/import` stub proves the round-trip by reading the
  connection through RLS.
- CI fix: removed the pnpm version double-pin that failed the first runs.

## Resolution

Live end-to-end test passed: the user signed in with their Google account,
approved the gmail.readonly consent, and landed on /import showing the
connected mailbox. Verified in the database: 1 auth user, 1 connected
`gmail_connections` row, 1 `gmail_refresh:*` secret in Vault. M1's success
criterion is met; M2 (import pipeline) is unblocked.
