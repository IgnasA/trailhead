---
title: What deletion means for data we never read
label: wayfinder:task
status: open
assignee:
map: ../map-manual-flights.md
blocked-by: [24]
---

## Question

The privacy panel's logic is that every action names exactly what it destroys,
and that each one is survivable because the data can be rebuilt: "Delete my
history" promises that "importing again rebuilds your history without
re-reading Gmail". Manual flights are original input. Nothing rebuilds them.

- **"Delete my history" keeps typed flights** and says so plainly. Sweeping
  unrecoverable input into an action whose whole premise is recoverability
  would make the one honest promise in that panel false.
- **A fourth action, "Delete the flights I added"**, worded separately like
  the other three, with its own typed confirmation and its own consequence
  copy — this one genuinely cannot be undone.
- **"Delete my emails" leaves them untouched**, since they never had one.
- **"Delete my account"** still takes everything.
- The copy lives once, in `packages/domain/src/privacy.ts`, which generates
  the consent screen, the privacy page and `docs/privacy.md` — so the new
  action and the amended "delete my history" consequence are written there and
  nowhere else. The settings page's list of what Trailhead holds gains typed
  flights for the same reason.
