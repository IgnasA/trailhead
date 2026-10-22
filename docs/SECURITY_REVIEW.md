# Security review — 2026-10-22

A review of the whole repository on top of `claude/night-maintenance`. It
covers the Next.js web app, the import worker, the shared packages, the
Supabase migrations, CI, and the git history. It did **not** cover the live
Supabase project: the reviewer had no access to it, and several functions
the app depends on exist only there (finding H1).

## The system in one paragraph

Trailhead reads a person's Gmail (`gmail.readonly`) and rebuilds their flight
history from booking emails. Users sign in with Google through Supabase Auth.
The Gmail refresh token goes into Supabase Vault through the
`store_gmail_connection` definer function. Two server processes hold a
privileged `DATABASE_URL`: the Next.js app (`apps/web`, for Vault reads and
history rebuilds) and the worker (`apps/worker`, on Fly). The worker sends
email text to Anthropic for extraction and sends completion emails through
Resend. The browser talks to Supabase directly with the publishable key. RLS
lets each user read their own rows, and every write goes through
`SECURITY DEFINER` functions scoped by `auth.uid()`. The sensitive data is the
Gmail refresh token, the person's travel history (dates, routes, booking
references, prices), and email subjects. Email bodies are never stored.

## Summary

| ID | Severity | Finding | Status |
|---|---|---|---|
| H1 | High | 8 RPCs the app calls exist only in the live DB, so their access control can't be reviewed | Recommendation |
| M1 | Medium | `store_gmail_connection` trusted a caller-supplied email, which then received worker emails | **Fixed** (migration 16) |
| M2 | Medium | No rate limiting on expensive or quota-spending routes | Recommendation |
| M3 | Medium | The web server process holds a superuser-level `DATABASE_URL` | Recommendation |
| M4 | Medium | Manual-flight input unvalidated: unbounded text, no date check on PATCH, 500 on bad JSON | **Fixed** |
| M5 | Medium | No security headers; the settings page and its deletion buttons could be framed | **Fixed** (baseline); script CSP is a recommendation |
| L1 | Low | Cookie-authenticated mutating routes had no CSRF check beyond SameSite=Lax | **Fixed** |
| L2 | Low | Airport search built a PostgREST `or()` filter from a denylist-sanitised string | **Fixed** |
| L3 | Low | Manual-flight definer functions executable by `anon`; `search_path` left pg_temp first | **Fixed** (migration 16) |
| L4 | Low | `/api/disconnect` returned raw Postgres error text | **Fixed** |
| L5 | Low | Source-email id unvalidated; Gmail path segments unencoded | **Fixed** |
| L6 | Low | Workflow tokens had default permissions; the deploy uses `flyctl-actions@master` | Partly fixed |
| L7 | Low | Worker image runs as root, installs without the lockfile, and omits two workspace packages | Recommendation |
| L8 | Low | `delete_account` runs from the browser and can't revoke the Google grant | Recommendation |
| I1 | Info | Prompt injection through email content | Accepted, mitigated |
| I2 | Info | Secrets, dependencies, XSS, open redirects, logging | No issues found |

---

## High

### H1. Access control for eight RPCs is not in the repository

- **Where:** `supabase/migrations/00000000000007_reveal_stats.sql` and
  `00000000000010_settings_and_corrections.sql` are comment-only stubs ("see
  the applied definition in the Supabase project"). Migration `…06` is missing
  from the sequence. The app calls `reveal_stats`, `dashboard_stats`,
  `flights_per_year`, `record_correction`, `disconnect_gmail`,
  `delete_source_emails`, `delete_history` and `delete_account` from the browser
  or from server components (`apps/web/app/settings/DangerAction.tsx:43`,
  `apps/web/app/dashboard/page.tsx:18`, `apps/web/app/reveal/page.tsx:13`,
  `apps/web/app/dashboard/flights/[id]/Corrections.tsx:25`). None of them are
  defined anywhere in the repo.
- **Impact:** These are almost certainly `SECURITY DEFINER`, like the rest of
  the schema, which means they bypass RLS. If any of them omits its
  `user_id = auth.uid()` filter, or is still executable by `anon`, any visitor
  holding the public publishable key can read another person's statistics or
  delete their data. `record_correction(p_kind, p_flight_id, p_payload)` takes a
  flight id and arbitrary JSON. It must check that the flight belongs to the
  caller. The repo also can't recreate the database: a fresh environment built
  from these migrations would be missing those functions.
- **Fix:** Dump the live definitions into a new migration with
  `supabase db pull`, or with `pg_dump --schema-only` restricted to these
  functions. Then confirm three things for each function: (a) it raises when
  `auth.uid()` is null, (b) every statement filters by `auth.uid()`, including
  the `flight_id` ownership check in `record_correction`, and (c) it runs
  `revoke all … from public, anon`. `scripts/test-migrations.sh` can then
  assert this the same way `supabase/tests/security_hardening.test.sql` does.
  Running the Supabase security advisor (`get_advisors`) on the project will
  also flag definer functions that `anon` can execute.
- **Confidence:** High that the gap exists. The severity of any real flaw
  can't be determined from the repo.

## Medium

### M1. Caller-chosen mailbox address receives the worker's email — fixed

- **Where:** `supabase/migrations/00000000000003_store_gmail_connection.sql`.
  The worker sends to that address in `apps/worker/src/email.ts:11`.
- **Impact:** `store_gmail_connection(p_email, p_refresh_token)` is granted to
  `authenticated`, so any signed-in user can call it directly through PostgREST
  and pass any `p_email`. The value went into `gmail_connections.email_address`.
  The completion email goes to that address, so it could be pointed at
  strangers, and the settings page would display the forged address.
- **Fix (applied):** Migration `00000000000016_security_hardening.sql` takes the
  address from `auth.users` and ignores `p_email`. It also caps the token
  length. Tested in `supabase/tests/security_hardening.test.sql`. **The
  migration has not been applied to any real project.** Apply it through the
  normal release process.
- **Confidence:** High.

### M2. No rate limiting

- **Where:** Every route in `apps/web/app/api/`. The costly ones:
  - `/api/scan` lists every candidate message id, at up to 5 Gmail quota units
    per 500 ids, and refreshes a Google token on every call.
  - `/api/source-email/[id]` refreshes a token and fetches a full message.
  - `/api/rebuild` and `/api/manual-flights` delete and rebuild all of the
    user's flights and trips.
  - `/api/airports` takes no authentication and runs three `ILIKE` scans.
- **Impact:** A signed-in user, or a script holding their cookie, can burn the
  shared Google OAuth client's quota and DB CPU. The airport search can be
  hammered anonymously. The 50-flight cap on manual flights is the only
  existing limit.
- **Fix:** Add per-user limits on the authenticated routes (for example 10/min
  on scan and rebuild, 60/min on source-email) and a per-IP limit on airports.
  Serverless hosting needs a shared store for this, such as Upstash Redis or a
  `rate_limits` table with a definer function. Alternatively, limit at the
  edge (Vercel/Cloudflare WAF). Also add a `pg_trgm` index if the airport
  search stays anonymous. Not done here because it needs an infrastructure
  choice.
- **Confidence:** High.

### M3. The web app runs with a fully privileged database connection

- **Where:** `apps/web/app/api/{scan,disconnect,rebuild,manual-flights,source-email}`
  all open `pg.Pool(DATABASE_URL)`. They read `vault.decrypted_secrets` and
  bypass RLS.
- **Impact:** User scoping in these routes comes only from application code
  (`user.id` from `getUser()`) and from the definer functions. Any server-side
  bug (SSRF, dependency RCE, a mistaken query) in the Next.js process gets
  every user's Gmail refresh token and every row. `manual-flights` asserts the
  user's identity by `set_config('request.jwt.claims', …)` on a privileged
  connection. That works, but it relies on each RPC using `auth.uid()`.
- **Fix:** Create a dedicated `trailhead_web` login role. Grant it only
  `execute` on a small definer function `gmail_refresh_token_for(uuid)` plus
  the tables `rebuildHistory` writes, and give it no direct `vault` access. Use
  that role for `DATABASE_URL` in the web app. Keep the full role on the
  worker only. A longer-term option is to move token-using calls (scan, source
  fetch) into the worker or an Edge Function.
- **Confidence:** Medium. The role behind `DATABASE_URL` isn't visible from the
  repo, but reading `vault.decrypted_secrets` requires a privileged role.

### M4. Manual-flight input validation — fixed

- **Where:** `apps/web/app/api/manual-flights/route.ts`.
- **Impact:** The free-text fields (`flight_number`, `booking_ref`) had no
  length limit in the API or the table: 50 rows × megabytes each per user.
  PATCH never validated `date`. Non-string JSON values reached Postgres and
  produced 500s. Malformed JSON threw before the `try`, which also produced a
  500. There was no body size cap.
- **Fix (applied):** `apps/web/lib/http/manualFlight.ts` parses and bounds every
  field: real calendar dates, `HH:MM[:SS]` times, two-character airline codes,
  three-letter currencies, price within `numeric(10,2)`, uuid ids, and an 8 KB
  body. Migration 16 adds a matching table constraint (`NOT VALID`, so existing
  rows aren't re-checked). Tests are in `manualFlight.test.ts`.
- **Confidence:** High.

### M5. Security headers — baseline fixed, script CSP outstanding

- **Where:** `apps/web/next.config.ts` (previously set no headers).
- **Impact:** Any site could iframe `/settings`, whose irreversible deletion
  buttons are clickjacking targets. Responses also lacked `nosniff`, a
  referrer policy and HSTS.
- **Fix (applied):** These headers now go on every route:
  - `frame-ancestors 'none'`, `base-uri 'self'`, `object-src 'none'` and
    `form-action 'self'` (CSP)
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - a restrictive `Permissions-Policy`
  - HSTS

  `X-Powered-By` is removed. Tests are in `securityHeaders.test.ts`, and the
  headers were checked against `next start`.
- **Recommendation:** Add a nonce-based `script-src` / `connect-src` policy
  (Next middleware nonces, `connect-src 'self' https://<ref>.supabase.co
  wss://<ref>.supabase.co` plus the basemap tile hosts, `worker-src 'self'
  blob:` for MapLibre). It wasn't done here because it can break hydration and
  the map, and it needs testing in a browser.
- **Confidence:** High.

## Low

### L1. CSRF on cookie-authenticated routes — fixed

`POST/PATCH/DELETE /api/manual-flights`, `POST /api/rebuild` and
`POST /api/disconnect` authenticate by session cookie, with no CSRF token or
origin check. `@supabase/ssr` sets `SameSite=Lax`, which already blocks
cross-site POSTs in current browsers, so the remaining exposure is older
browsers and subdomain attackers. **Fixed:** `apps/web/lib/http/sameOrigin.ts`
rejects requests whose `Origin` (or `Sec-Fetch-Site`) is not this host.
Tested, and checked live: a forged Origin returns 403. Confidence: high.

### L2. PostgREST filter built from user text — fixed

`apps/web/app/api/airports/route.ts` interpolated the typed query into
`.or("iata.ilike.X%,…")` after stripping only `% _ , ( )`. Quotes, `\`, `*`,
`.` and `:` passed through. The table is public reference data, so the worst
case was malformed filters and 502s. **Fixed** with a character allowlist
(letters, marks, digits, space, hyphen, apostrophe) and a 64-character cap
(`lib/http/airportTerm.ts`, tested). Confidence: high.

### L3. Definer-function grants and search_path — fixed

Migrations 12 and 13 never revoked the default `PUBLIC` execute grant, so
`anon` could call `add/update/delete_manual_flight` and
`delete_manual_flights`. Each fails closed on a null `auth.uid()`. Their
`search_path = public` also leaves `pg_temp` searched first.
**Fixed** in migration 16. Confidence: high.

### L4. Raw database errors returned to the browser — fixed

`/api/disconnect` returned `error.message` from the RPC. It now logs the
message and returns `disconnect_failed`. Separately, `DangerAction.tsx:45`
displays PostgREST error text for browser-side RPC calls. That text is already
visible to the user in the network tab, so this is cosmetic. Confidence: high.

### L5. Source-email id and Gmail URL encoding — fixed

`/api/source-email/[id]` now 404s on any id that isn't a uuid.
`packages/gmail` encodes `id` and `pageToken` into URLs. Both values came from
trusted sources (RLS-scoped rows, Google's responses), so this is hardening.
Confidence: high.

### L6. CI token scope and an unpinned deploy action — partly fixed

Both workflows now declare `permissions: contents: read`. Still open:
`.github/workflows/deploy-worker.yml` uses
`superfly/flyctl-actions/setup-flyctl@master` in the job that holds
`FLY_API_TOKEN`. A compromised upstream branch would get that token. **Pin it
to a full commit SHA** and let Dependabot update it. Also consider a GitHub
`environment` with required reviewers for the deploy. Confidence: high.

### L7. Worker image

`apps/worker/Dockerfile` runs as root, which is the `node` base image default.
Fix: `USER node`. It installs with `--frozen-lockfile=false`, so builds can
pull versions that were never reviewed or audited. Fix: copy `pnpm-lock.yaml`
and use `--frozen-lockfile`. It also copies only `packages/domain`, but the
worker imports `@trailhead/gmail` and `@trailhead/history`. The
`deploy-worker.yml` path filter likewise misses changes to those packages, so
a fix in `packages/gmail` would never redeploy. Not changed here because the
deploy can't be exercised from this review. Confidence: high.

### L8. Account deletion and the Google grant

`delete_account` is called straight from the browser
(`DangerAction.tsx:43`), so it can't revoke the refresh token at Google. Only
`/api/disconnect` does that. Whether the RPC deletes the Vault secret is
unknown (H1). If it doesn't, the token outlives the account. **Fix:** route
`delete_account` through a server endpoint that does what
`/api/disconnect` does first (revoke, then destroy), and make sure the RPC
deletes `gmail_refresh:<uid>` from Vault. Confidence: medium.

## Informational

### I1. Prompt injection via email content

Email text goes to Claude Haiku (`apps/worker/src/llm.ts`). A crafted email in
someone's mailbox can make the model output a fabricated flight. Mitigations
already in place: a strict tool schema, Zod re-validation, airport foreign
keys, a fixed confidence value, and no tools with side effects. The impact is
limited to wrong rows in the victim's own history. No change recommended
beyond the planned eval harness.

### I2. Checked and found clean

- **Secrets:** All 60 commits on all branches were scanned for Google client
  secrets (`GOCSPX-`), Anthropic/Resend/Supabase secret keys, JWTs, Postgres
  URLs with passwords, AWS keys, Fly tokens and private keys. None were found.
  `.env*` is git-ignored. The Supabase project ref and URL appear in
  `tracker/tickets/013-*`, and those are public identifiers. No rotation
  needed.
- **Dependencies:** `pnpm audit` reports no known vulnerabilities after the
  maintenance branch's updates (Next 15.5.28, postcss override).
- **XSS:** No `dangerouslySetInnerHTML` anywhere. The live email body is
  rendered as text (`SourceEmail.tsx`), and highlight terms are regex-escaped.
- **Open redirects:** `/auth/callback` redirects only to fixed paths on its own
  origin. The OAuth `redirectTo` is `window.location.origin`. Make sure the
  Supabase Auth redirect allowlist has no wildcards.
- **Auth on routes:** Every API route except the public airport search calls
  `supabase.auth.getUser()`, which validates with the auth server, rather than
  `getSession()`. Every page under `/dashboard`, `/settings`, `/plan`,
  `/import` and `/reveal` redirects when signed out. RLS on every user table is
  owner-read, with no write policies.
- **Client env exposure:** Only `NEXT_PUBLIC_SUPABASE_URL` and the publishable
  key are exposed, as intended.
- **Logging:** The worker and routes log ids and error messages, never email
  content or tokens. Import failure reasons are categorical.
- **File uploads:** None. The "save as image" feature runs client-side.
- **SQL injection:** Every `pg` query is parameterised (`packages/history`,
  worker, routes).

## Testing what was changed

```bash
pnpm typecheck && pnpm test && pnpm --filter @trailhead/web build
# Migration assertions, against a throwaway local Postgres only:
TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres scripts/test-migrations.sh
```
