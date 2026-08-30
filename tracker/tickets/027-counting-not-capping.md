---
title: Counting, not capping
label: wayfinder:task
status: closed
assignee: Ignas + Claude (this session)
map: ../map-manual-flights.md
blocked-by: [26]
---

## Question

Manual entry is **not capped**. It is counted, and the count is asked about
once.

Charting first put a hard cap at twenty, then at five. Both were wrong for the
same reason: a cap right-truncates the only measurement the feature could
produce. The purpose was to learn who would pay for more — but a wall at five
means you can never observe that someone would have entered forty flights, so
the signal degenerates to a single bit ("hit it / didn't") from a feature that
could have handed over the full distribution of how incomplete real imports
are. A cap can be added later from uncapped data; the curve you refused to
observe never comes back.

Three supporting facts, recorded so this isn't relitigated from memory:

- An import costs roughly $1.54 in Haiku calls. A manual entry costs a
  Postgres row. This is the one path where the user performs the extraction
  labour themselves, for free, with perfect accuracy — the wall was in the
  wrong place.
- At five, everyone with a genuine gap clears it immediately (the reference
  history is 102 flights), so "hit the cap" would have meant no more than
  "used the feature".
- The one real argument for a low cap — Gmail Testing mode caps the product at
  100 lifetime users, so a high wall might never fire and teach nothing — is an
  argument for asking *early*, not for blocking.

What to build:

- **A running count** of manual flights, shown on the form. Informational, not
  a countdown.
- **One prompt, the first time the count passes ten**: automatic re-import is
  something we're considering charging for — want it when it exists? It
  records the same `premium_interest` plan choice the plan step records, so the
  two are countable together. Dismissible, and asked once — never re-shown.
- **A guard at fifty**, in the RPC, commented as what it is: a stop for a
  runaway script, not a paywall. If a real person ever hits it, that is itself
  a finding worth acting on rather than a limit worth enforcing.
- The Free column's copy gains manual entry with no asterisk, because there
  now isn't one.

## Resolution

Built as specified, with the pieces that already existed left where earlier
tickets put them:

- **The running count** shows on the collapsed strip — "You've added 11
  flights yourself." — informational, no countdown, no ceiling named.
- **The one-time prompt** appears past ten typed flights: "Automatic
  re-import … is something we're considering charging for. Nothing exists to
  buy yet", with "Tell me when it exists" / "Not for me". Either answer is
  recorded server-side via `choose_plan`, so no device ever shows it twice; a
  plan-step `premium_interest` also suppresses it (they already said yes).
- **`plan_choices` grew** `premium_not_now` and a `context` column
  (`plan_step` | `manual_flights`) — migration 15 — so the two interest
  sources are distinguishable but countable together, and "not now" is itself
  signal. `choose_plan` was re-signatured with a defaulted `p_context`; the
  plan step's existing 2-arg call still resolves, verified.
- **The guard at fifty** already sat in `add_manual_flight` (migration 12),
  commented as what it is — a stop for a runaway script, not a paywall — and
  the form ticket's 409 copy already treats hitting it as a finding.
- **The Free column** already carries "Add flights we missed, or that predate
  your mailbox", with no asterisk, because there isn't one.

**Verified live**: seeded 11 typed flights (113 total), saw the count strip
and the prompt render; answered "Not for me"; the row landed as
`premium_not_now` / `manual_flights`; on reload the count remained and the
prompt did not. All test data removed afterwards — including the test answer
row, which was mine, not the user's — history restored to 102 / 12 / 30 / 49
and `plan_choices` to its single real row.
