---
title: What deletion means for data we never read
label: wayfinder:task
status: closed
assignee: Ignas + Claude (this session)
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

## Resolution

The copy lives once, in `packages/domain/src/privacy.ts`, so the consent
screen, the privacy page and `docs/privacy.md` all moved together
(`pnpm docs:privacy` regenerated the doc).

- **A fourth action, "Delete the flights I added"**, between "Delete my
  history" and "Delete my account", with its own typed confirmation
  ("Delete added flights"). Its consequence copy is the only one in the panel
  that says the deletion genuinely cannot be undone, because it is the only
  one where that is true.
- **"Delete my history" keeps them**, and now says so: typed flights "reappear
  the next time your history is rebuilt — they are yours, not something we
  reconstructed."
- **"Delete my account"** now enumerates them too.
- **`WE_STORE` gains "Flights you add yourself"** — we do store them, so the
  consent screen has to say it.
- **Settings** lists "Of those, added by you" under what we hold, and the new
  action is disabled when the count is zero.

### The deletion is not `delete from flights where source='manual'`

The first version was, and it was wrong: a flight where a typed entry merged
with real emails also carries `source='manual'`, so deleting by source would
have destroyed a flight the emails prove the person took. The applied function
removes only flights with no `flight_sources` behind them, and reverts the
corroborated ones to `imported`; the next rebuild restores their extracted
field values.

**Verified live in a rolled-back transaction**: two typed flights added (one
with no email behind it, one duplicating an extracted flight) took the history
to 103 with 2 marked manual. `delete_manual_flights()` returned 2, and left
102 flights, 0 still marked manual, the pure typed flight **gone**, the
corroborated one **surviving**, and `manual_flights` empty. Restored to
102 / 12 / 30 / 49.

One thing left for the form ticket, recorded there: "Delete my history" keeps
typed flights but they only reappear on the next rebuild. Once a rebuild
endpoint exists, that action should call it.
