---
title: Extraction cost reduction and the plan step
label: wayfinder:task
status: closed
assignee: Ignas + Claude (this session)
blocked-by: []
---

## Question

Cut what an import costs to run, and add a plan/pricing step after Gmail is
connected showing what was found.

## Cost: no cheaper model, three architectural levers

Checked against current pricing: **Haiku 4.5 ($1/$5 per MTok) is already the
cheapest model** — Sonnet 5 is double, Opus 5 five times. Prompt caching was
considered and rejected on measurement: Haiku 4.5 requires a 4,096-token
minimum cacheable prefix and ours is ~600 tokens, so it would silently never
cache.

Everything below was designed against a 70-email sample of the live mailbox
(10 of which contained flights), not guessed:

| Signal | Hit on flight mail | Hit on other mail | Verdict |
|---|---|---|---|
| Flight-number token | 9/10 | 8/60 | Good gate |
| Route pattern (`VNO → BCN`) | 2/2 | 0/60 | Good gate |
| Booking-reference phrasing | 9/10 | **45/60** | Rejected — useless |
| Marketing words | 1/10 | 32/60 | Weak; not used alone |

1. **Pre-filter requires flight evidence** (flight number or route) before an
   LLM call. ~75% fewer calls for ~10% recall loss; rejected emails are cached
   as non-flights so they are never paid for twice.
2. **Batch API** at half price when there are ≥20 candidates, synchronous
   below that. The batch id lives on the job so a restart resumes polling
   rather than re-submitting, and the progress page states the tradeoff.
3. **Body cap 12k → 6k chars**: the sample averaged 5,217 chars, a third
   exceeded 6k, and every route/flight-number match fell inside the first 6k.

Expected effect on a first import of this mailbox: roughly $1.54 → $0.20–0.30.
Unverified in production — the mailbox is now fully cached, so re-running
costs nothing and proves nothing. The next genuinely new mailbox is the test.

## The plan step

Scope note: billing was **out of scope** on the map. The user redrew that, so
it returns as this ticket rather than as a resumption.

`/plan` sits between the OAuth grant and the import: it counts candidate
emails live and offers Free (everything built) against Premium (€30/year,
labelled *not built yet*). Choosing Premium records interest only — no
payment details are collected anywhere in the app, which is both the honest
position and the willingness-to-pay signal brief §36 asks for before building
billing.

Gmail's `resultSizeEstimate` proved badly wrong (201 for a mailbox with 740
matches), so the scan counts ids properly — two API calls, still cheap.

Verified live: plan choice recorded (`free`, 740 candidates), import ran in 22
seconds with **0 LLM calls** because all 740 emails were already cached, and
rebuilt 102 flights and 12 trips for nothing. That is the skip-cache doing
exactly what it was designed for.
