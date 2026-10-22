---
title: Replay corrections over a rebuild
label: wayfinder:task
status: closed
assignee: Claude (overnight session)
map: ../map.md
blocked-by: [21]
---

## Question

[M6](021-m6-settings-and-corrections.md) left corrections recorded but not
replayed: `rebuildHistory` deletes every Flight and re-derives it from
Extractions, so an airport fix or a "Not a flight" survived only until the
next import, manual add or rebuild. CONTEXT.md already promised the opposite
("Corrections replay over re-imports and re-merges (last write wins)").

## Resolution

- **Corrections are inputs to the rebuild.** After emails and typed flights
  merge, corrections apply to the merged groups oldest first
  (`packages/history/src/corrections.ts`, pure and unit-tested). A field fix
  re-keys its group, so a second correction on the same flight chains; if
  the fixed flight lands on one another email already had right, the two
  merge, the corrected values winning and every email link kept.
- **Identity, not id.** `corrections.flight_id` is `on delete set null` and
  every rebuild deletes the flight, so the id cannot find the flight again.
  A correction now carries `payload.target` — the five merge-key fields as
  the person saw them — which the flight detail page sends with the RPC.
- **Corrections made before this** carry only the id. The rebuild stamps
  their `target` once, while the id still resolves: for a field fix from the
  linked extraction (the row already shows the corrected route), for "not a
  flight" from the row itself. The stamp adds a key; it changes nothing the
  event said.
- **"Not a flight" is written, with that status.** The label is the eval
  example, so the row stays; it is excluded from trip chaining, never marked
  for review, and filtered from the flights and trips lists. Stats already
  count `flown` only.
- **A correction whose flight is gone** (emails deleted, re-extracted under
  a different identity) is held, counted as `unmatched` in the rebuild
  result, and applies again if the flight comes back.
- Verified against the repo's own migrations in PGlite
  (`packages/history/src/rebuild.test.ts`): the `VIL`-for-`VNO` fix keeps
  its route and distance and closes its trip across rebuilds; rebuilding
  twice is idempotent; legacy corrections are recovered.

## Left for later

- `assign_trip` corrections — trip pinning ([Trip reconstruction
  rules](011-trip-reconstruction-rules.md)) — still have no recorder and are
  counted as unmatched.
- `record_correction`'s body is not in the repo (migration 010 says "see the
  Supabase definitions"). Replay assumes it stores `p_payload` verbatim.
  Committing the live definitions as a migration would remove the guess.
- A correction made before this change whose flight was already rebuilt away
  has no id and no target; nothing left in the data says which flight it
  meant. It stays in the eval dataset but cannot replay.
