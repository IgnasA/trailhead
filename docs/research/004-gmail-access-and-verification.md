# Research: Gmail access with `gmail.readonly` and Google's verification regime

Resolves ticket `tracker/tickets/004-gmail-access-and-verification.md`.
Researched 2026-08-28 against Google primary sources (developers.google.com, support.google.com, appdefensealliance.dev). The repo had no prior research-notes convention, so this file establishes `research/` with ticket-number-prefixed filenames.

## TL;DR

- `gmail.readonly` is a **restricted** scope. Full verification = OAuth app verification (~6 weeks) **plus** an annual CASA security assessment by a third-party lab (Google charges nothing; labs charge roughly $540–$1,800/yr at the Google-negotiated TAC Security rate for the common tier).
- An unverified MVP can run meaningfully far: **100 test users** in Testing mode (tokens expire every 7 days), or a lifetime cap of **100 users** past the "unverified app" screen in production. Verification becomes unavoidable at real launch.
- `gmail.metadata` does **not** change the calculus: it is equally restricted, and it blocks both the `q` search parameter and `full`/`raw` message formats — so it can neither find flight emails by query nor read bodies.
- A ~1,200-message import is trivial against quota (~24k units vs 6,000 units/min/user): roughly 4–5 minutes at the per-user ceiling, batched 50 per request.
- Limited Use permits storing extracted flight records and fetching bodies live for display. Nothing contradicts the store/never-store table. Watch-outs: no human access to message content (even for debugging) without per-message user consent, and no training generalized AI/ML models on Gmail-derived data.

---

## 1. Verification regime

### Scope classification

All Gmail message-content scopes are **restricted**: `gmail.readonly` ("View your email messages and settings"), `gmail.metadata`, and `gmail.modify` are each listed as restricted in the [Gmail API scopes reference](https://developers.google.com/workspace/gmail/api/auth/scopes). Restricted scopes trigger the heaviest verification tier and the Limited Use policy (section 3).

### What full verification requires

Per [Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) and the [OAuth verification help center](https://support.google.com/cloud/answer/9110914):

1. **Brand verification** — app name, logo, privacy policy, homepage, domains verified via Search Console. Estimated **2–3 business days** ([FAQ](https://support.google.com/cloud/answer/13463817)).
2. **Restricted-scope (data access) verification** — demonstrate the app is a *permitted application type* (see below), justify minimum scopes, and submit an unlisted YouTube video showing the OAuth consent flow and actual scope usage. Estimated **6 weeks** ([FAQ](https://support.google.com/cloud/answer/13463817)); the overall process "may take several weeks."
3. **CASA security assessment** — required when restricted-scope data is stored/transmitted on servers (i.e., not a purely local client). Trailhead stores extracted flight records server-side, so this applies.

**Permitted application types** ([Workspace API user data and developer policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)): email clients; automatic email backup; "applications that enhance the email experience for productivity purposes"; and — the best fit for Trailhead — **"applications that use information from emails to provide reporting or monitoring services for the benefit of users."** Prohibited types include mobile keyboards and one-time/manual email export. Trailhead should frame itself in the verification submission as a user-benefit reporting service over the user's own email.

### CASA: tiers, cost, timeline

- Google uses the App Defense Alliance's [CASA framework](https://appdefensealliance.dev/casa) (based entirely on OWASP ASVS). Assessment is "risk-based, multi-tiered … based on user count, requested scopes, and other application-specific signals"; apps are assigned **AL1 or AL2** ([Security Assessment help page](https://support.google.com/cloud/answer/13465431)). Google does not publish the user-count thresholds; the tier is assigned during verification. Once validated at AL2, an app stays at AL2 in later years.
- Both AL1 and AL2 are completed through **ADA-authorized labs** (TAC Security, DEKRA, Leviathan, etc.); AL2 is a comprehensive lab test of the app, its deployment infrastructure, and data storage locations ([CASA assurance levels](https://appdefensealliance.dev/casa/casa-tiering)).
- **Cost**: "Google does not charge the developer any fees for security assessment"; the fee is between developer and assessor ([FAQ](https://support.google.com/cloud/answer/13463817)). Market rates (secondary sources, 2025–2026): Google-negotiated TAC Security pricing ~**$540–$1,800/year** for the common lab-validated-scan tier; other labs $800–$1,200+; the old "$15k–$75k" figures predate CASA and no longer apply ([provider survey](https://www.switchlabs.dev/post/casa-tier-2-tier-3-security-review-providers-pricing-and-the-cheapest-option), [deepstrike overview](https://deepstrike.io/blog/google-casa-security-assessment-2025)).
- **Recurrence**: assessment must be repeated **every 12 months** from the effective date of the previous Letter of Validation (LOV) ([Annual re-verification](https://support.google.com/cloud/answer/13463816)). Passing yields an LOV from the assessor.

### Hard caps for an unverified app

From [Manage App Audience](https://support.google.com/cloud/answer/15549945) and [Using OAuth 2.0](https://developers.google.com/identity/protocols/oauth2):

| Constraint | Value |
|---|---|
| Testing-mode test users | max **100** listed test users |
| Testing-mode token life | authorizations (incl. refresh tokens) **expire 7 days** after consent (external user type, non-basic scopes) — users must re-consent weekly |
| Unverified production cap | **100 new users total, lifetime**, after the "unverified app" warning screen; cannot be reset — once exhausted, sign-in is disabled for new users |
| Consent screen | test users and unverified-app users see explicit warning screens about granting data to an unverified app |
| Refresh tokens generally | 100 live refresh tokens per Google account per client ID; tokens die after 6 months unused, or on password change **when Gmail scopes are involved** |

**MVP runway**: build and dogfood indefinitely in Testing mode with ≤100 named test users, accepting weekly re-auth (or design import as re-runnable so a dead token just means "reconnect Gmail"). The lifetime-100 production cap is a trap — burning it on a soft launch is irreversible on that project. Start verification ~2 months before any public launch.

### Does `gmail.metadata` (or anything narrower) help?

**No.**

- `gmail.metadata` is itself **restricted** ([scopes reference](https://developers.google.com/workspace/gmail/api/auth/scopes)) — identical verification burden.
- It cannot search: on `messages.list`, the `q` "parameter cannot be used when accessing the api using the gmail.metadata scope" ([messages.list reference](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list)) — so no `from:airline subject:itinerary` targeting; you'd enumerate the whole mailbox.
- It cannot read bodies: `messages.get` under the metadata scope is limited to metadata formats (no `full`/`raw`) ([messages.get reference](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get)) — flight details (times, flight numbers, confirmation codes) live in bodies, so import-time parsing is impossible.
- Non-restricted alternatives (`gmail.labels`, `gmail.send`, add-on scopes like `gmail.addons.current.message.readonly`) don't allow bulk historical reads at all.

**Recommendation: request exactly one data scope, `https://www.googleapis.com/auth/gmail.readonly`.** It is the minimum scope that supports both query-based discovery and body parsing, and minimum-scope framing is itself a verification requirement.

---

## 2. API mechanics

### Finding flight emails

`messages.list` accepts Gmail's user-facing [search operators](https://support.google.com/mail/answer/7190) via `q`. Useful for flight import:

- `subject:` , `from:` , exact phrases in quotes (`"boarding pass"`, `"flight confirmation"`)
- Date windows: `after:2015/01/01`, `before:`, `older_than:1y`, `newer_than:2d` (useful for chunked backfill and cheap re-scan)
- Disjunction: `OR` or brace groups — `{from:delta.com from:ryanair.com subject:itinerary}`
- `category:reservations` / `category:purchases` — Gmail's own ML categorization of travel/booking mail; a strong first-pass net (categories: primary, social, promotions, updates, forums, reservations, purchases)
- `has:attachment`, `filename:pdf` for e-ticket attachments

Practical strategy: union of `category:reservations`, airline-sender lists, and subject-keyword queries; dedupe by message `id`.

### list / get formats

- `messages.list`: returns only message `id` + `threadId` per item; `maxResults` default 100, **max 500**; paginate with `pageToken` ([reference](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list)).
- `messages.get` `format` ([reference](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get)):
  - `metadata` (+ `metadataHeaders=[From,Subject,Date]`) — headers only; enough for the candidate triage pass and for storing subject/message-id.
  - `full` — parsed MIME payload (body parts base64url) — what the parser needs at import time.
  - `raw` — entire RFC 2822 message; heavier, only needed if we want to hash the exact raw bytes.
  - `minimal` — ids/labels only.
- Two-phase import keeps body handling minimal: `list` → `get(format=metadata)` triage → `get(format=full)` only for likely flight emails → parse → discard body.

### Batching

[Batch guide](https://developers.google.com/workspace/gmail/api/guides/batch): multipart/mixed to the batch endpoint; hard limit **100 calls/batch**, but ">50 requests is not recommended" (rate-limit risk). Batching saves HTTP overhead only — **n batched calls cost n × quota**.

### Quota and the ~1,200-message scan

Current [usage limits](https://developers.google.com/workspace/gmail/api/reference/quota) (2026 model — note billing for overage begins in 2026 with 90 days' notice):

- Per method: `messages.list` 5 units, `messages.get` 20 units, `history.list` 2 units (`threads.get` 40).
- **Per user per project: 6,000 units/min** (~100 units/sec). Per project: 1,200,000 units/min; 80,000,000 units/day.

For a 1,200-message import: ~3 list pages ≈ 15 units + 1,200 × `get(full)` × 20 = 24,000 units ≈ **~24,015 units total** — negligible against daily quota; the per-user 6,000/min ceiling means ~300 gets/min, i.e. **~4–5 minutes minimum** for the full-body pass. With a metadata triage pass first (also 20 units/get, so triage only pays off in bandwidth/parse cost, not quota), plan on the same order. Implement exponential backoff on 429/`rateLimitExceeded` and cap concurrent batches (~2 batches of 50 per user per minute is safely under the ceiling).

### Incremental re-sync

[Sync guide](https://developers.google.com/workspace/gmail/api/guides/sync): store the largest `historyId` seen at import; later call `history.list?startHistoryId=...` (2 units) to get only added/changed message ids, then `get` just those. History records are "typically available for at least one week and often longer"; a **404 means the historyId aged out → fall back to a full (query-scoped) re-scan**. For Trailhead, sync at most weekly or trigger full re-scan with `newer_than:` windows — both cheap.

---

## 3. Data handling: Limited Use vs Trailhead's model

Sources: [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy) (Limited Use section) and the [Workspace API user data and developer policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy).

What Limited Use requires for restricted-scope (Gmail) data — and it explicitly covers data "aggregated, anonymized, or derived from" it, i.e., **our extracted flight records are covered data**:

- Use only "for providing or improving user-facing features that are prominent in the requesting application's user interface." Reconstructing and displaying the user's flight history is exactly such a feature → **storing extracted flight records + message id/subject/hash is compliant**.
- No transfer/sale to third parties; no ads/retargeting; no credit-worthiness use.
- **No human access** to the data unless the user gives "affirmative agreement to view specific messages" (or security/legal/aggregate-anonymized exceptions). Operational consequence: engineers may not read users' parsed flight rows or fetched bodies while debugging without per-case consent — build redacted logging and never log bodies or subjects.
- **No AI/ML training**: Workspace data may not be used "to create, train, or improve a machine learning or artificial intelligence model beyond that specific user's personalized model." Consequence: flight emails can be parsed with an LLM at inference time, but parser training/fine-tuning/eval sets must not be built from user emails.

**Fetching bodies live on demand for display**: compliant — it is read-only use, for a prominent user-facing feature, and *reduces* stored data, which is the direction the policy pushes. Nothing found contradicts the store/never-store table or the never-persist-bodies promise. Two accuracy notes for the product's own claims:

1. Message **subjects are themselves restricted-scope data** — storing them is fine under Limited Use, but the store/never-store table should not imply "we store no email content"; say "we never store email bodies" and list subject/message-id/hash in the store column (which the ticket already envisions).
2. Live body fetches depend on a valid grant — the display feature degrades when the token is revoked/expired (guaranteed weekly in Testing mode); the UI needs a "reconnect Gmail to view the original email" state.

Verification-adjacent obligations: privacy policy must disclose Gmail data use and Limited Use compliance in-product; deletion on user request is tested in the CASA assessment ("delete user data upon a user's request") — the account-deletion path must purge flight records and cached metadata.

---

## 4. Recommendation for the MVP

1. **Scope**: `gmail.readonly` only.
2. **Phase 1 (now)**: External + Testing mode, ≤100 named test users; treat weekly re-consent as a normal "reconnect" flow. Do **not** publish to production unverified — the lifetime 100-user cap is unrecoverable per project.
3. **Phase 2 (pre-launch, start ~2 months out)**: brand verification → restricted-scope verification (demo video; frame Trailhead as an email-derived reporting service for the user's benefit) → CASA via an authorized lab (budget ~$540–$1,800/yr; annual LOV renewal).
4. **Architecture commitments that make CASA/verification easier**: never persist bodies (already the design), redacted logging, hard delete path, server-side token encryption, minimum-scope OAuth client.
