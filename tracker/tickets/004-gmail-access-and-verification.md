---
title: Gmail access and OAuth verification constraints
label: wayfinder:research
status: closed
assignee: research agent (this session)
blocked-by: []
---

## Question

What does it actually take to read a user's flight emails with
`gmail.readonly`, and what does Google's verification regime mean for an MVP?
Specifically:

1. **Verification**: `gmail.readonly` is a restricted scope. What are the
   current (2026) requirements — OAuth verification, CASA/security assessment,
   cost, timeline? What are the hard caps for an *unverified* app (test-user
   limits, token expiry, consent-screen warnings), i.e. how far can an MVP get
   before verification is unavoidable? Is there a narrower scope
   (e.g. `gmail.metadata` — insufficient? — or restricted-scope alternatives)
   that changes the calculus?
2. **API mechanics**: search query operators for finding flight emails
   (from:, subject:, category:), `messages.list`/`messages.get` formats
   (metadata vs full), batching, quota units and per-user rate limits for a
   ~1,200-message scan, and incremental sync via `historyId` for re-imports.
3. **Data handling obligations**: Google's Limited Use policy as it applies to
   storing extracted flight records + message id/subject/hash while never
   persisting bodies (the wireframes' 1b/1h screens make specific promises —
   flag anything in policy that contradicts them).

Primary sources: Google Workspace / Gmail API docs and the OAuth verification
help pages. Resolution: findings file in the repo per the research skill, plus
a short answer here — the key numbers (caps, cost, timeline) and any wireframe
promise that policy contradicts.

## Resolution

Findings: `research/004-gmail-access-and-verification.md` on branch
`research/gmail-access` (commit f69d2f0), all claims cited to Google primary
sources.

- **Scope**: use `gmail.readonly` alone. `gmail.metadata` is equally
  restricted AND blocks the `q` search parameter and `full`/`raw` message
  formats — it can neither find flight emails nor read them.
- **Verification path**: brand verification (2-3 business days) + restricted-
  scope review (~6 weeks, demo video, permitted-app-type justification) +
  annual CASA assessment (AL1/AL2 — required since Trailhead stores extracted
  data server-side). Google charges nothing; authorized labs ~$540-$1,800/yr;
  revalidation every 12 months. Frame the submission under the permitted type
  "applications that use information from emails to provide reporting or
  monitoring services for the benefit of users".
- **Unverified caps**: Testing mode = 100 named test users, 7-day token/
  consent expiry (re-consent weekly). Publishing unverified = a *lifetime,
  unresettable* 100-user cap. So: dogfood indefinitely in Testing mode; never
  soft-launch unverified.
- **API mechanics**: search with `q` (`category:reservations`, sender/subject
  operators, `after:`/`older_than:` windows); `messages.list` 5 units (max
  500/page), `messages.get` 20 units (`metadata` triage, `full` to parse);
  batch <=50/request (no quota savings); per-user limit 6,000 units/min — a
  1,200-message full scan ~= 24k units ~= 4-5 min. Re-sync via stored
  `historyId` + `history.list` (2 units), ~1 week retention, 404 => fall back
  to query re-scan.
- **Limited Use**: the store/never-store table is compliant as designed;
  live on-demand body fetch is fine. Bake in: no human access to email-derived
  data without per-message consent (redacted logging), no training generalized
  AI models on user emails (inference-time LLM parsing is fine), and say
  "never store bodies" precisely — stored subjects are themselves
  restricted-scope data.
