---
title: Google Cloud OAuth setup
label: wayfinder:task
status: closed
assignee: Ignas + Claude (this session)
blocked-by: []
---

## Question

Stand up the Google side so development against real Gmail can start
(graduated from the fog by
[Gmail access and OAuth verification constraints](004-gmail-access-and-verification.md)):
create the Google Cloud project, enable the Gmail API, configure the OAuth
consent screen in **Testing mode** (per the resolved research: 100 named test
users, 7-day token expiry — dogfood here indefinitely; never publish
unverified), request the `gmail.readonly` scope, add the user (and any
testers) as test users, and create the OAuth client ID/secret for the app.

HITL: needs the user's Google account. The wizard skill fits this ticket —
generate a walkthrough once the stack decision fixes the redirect URLs.
Resolve by recording the project id, where the client credentials live
(never the secrets themselves), and the configured redirect URIs. Full
verification + CASA is a separate, later effort — out of this ticket.

## Resolution

Completed via [scripts/setup-google-oauth.sh](../../scripts/setup-google-oauth.sh)
(8 stages, resumable — kept in the repo as the repeatable setup path):

- **Supabase project**: `trailhead`, ref `giylqxatradpvsytpery`
  (eu-central-1), URL https://giylqxatradpvsytpery.supabase.co
- **Google Cloud project**: `trailhead-506918`; Gmail API enabled; consent
  screen in **Testing** mode with `gmail.readonly` as a requested scope and
  the owner added as a test user.
- **OAuth client** (web): origins https://giylqxatradpvsytpery.supabase.co +
  http://localhost:3000; redirect
  https://giylqxatradpvsytpery.supabase.co/auth/v1/callback; wired into
  Supabase Auth's Google provider.
- **Credentials**: client ID + secret live in git-ignored `.env.local` and in
  Supabase's Google provider config. Nothing in CI yet (no workflows exist).
- One stumble worth remembering: Google's "Authorized JavaScript origins"
  wants scheme+host only — the Supabase *dashboard* URL is never pasted into
  Google.

M1 (auth & connect) is no longer gated. Full verification + CASA remains a
separate pre-launch effort per the Gmail research ticket.
