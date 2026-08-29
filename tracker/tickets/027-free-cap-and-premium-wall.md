---
title: Five on Free, and the wall at six
label: wayfinder:task
status: open
assignee:
map: ../map-manual-flights.md
blocked-by: [26]
---

## Question

Manual entry is capped at five on Free. The cap counts manual flights only —
extracted flights are unlimited — and it is enforced server-side in the RPC,
not just hidden in the UI.

The interesting part is what the sixth attempt does. Premium is not
purchasable: it is an expression of interest with no billing behind it, so
this is a wall with no door. That makes it the most qualified paying signal
the product can collect, and it must be captured rather than wasted: hitting
the cap records a `premium_interest` plan choice, the same one the plan step
records, so the two are countable together.

- **Counted honestly from the first entry**: "1 of 5 added". At five, a limit
  you only discover on the sixth attempt reads as a bait-and-switch — and
  someone with sixty flights to enter deserves to know before they type five.
- **Grandfathered**: if the cap is ever lowered, flights already added are
  never deleted. The cap gates creation, nothing else.
- The wall's copy says what is true — that Premium doesn't exist yet, and that
  we'll tell them when it does — because the Premium column already says "Not
  built yet" three screens earlier and contradicting it would be the fastest
  way to lose the signal we're collecting.
