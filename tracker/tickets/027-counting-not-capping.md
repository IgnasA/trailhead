---
title: Counting, not capping
label: wayfinder:task
status: open
assignee:
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
