---
title: The add-a-flight form
label: wayfinder:task
status: closed
assignee: Ignas + Claude (this session)
map: ../map-manual-flights.md
blocked-by: [24, 25]
---

## Question

Build the form and put its door where the people who need it are standing.

- **Required**: origin, destination, date. **Optional**: airline, flight
  number, local departure and arrival times, booking reference, price.
  Everything optional stays genuinely optional — absence is information in
  this system, never a prompt to guess.
- **Entry points**: a primary action on the Flights page, *plus* every empty
  state (dashboard, flights, trips), *plus* a line in the Free column of the
  plan step — "Add flights we missed, or that predate your mailbox", which is
  also the honest answer to "what if my old flights aren't in Gmail?". Putting
  the door only on a populated list would hide it from exactly the people
  staring at a thin history.
- **After saving**, the rebuild runs synchronously through the shared module
  ([Shared history rebuild module](023-shared-history-rebuild.md)) and the
  flight is simply there — no job, no spinner tied to a worker that might be
  down.
- **Provenance**: the flight detail page reads "You added this on 3 March
  2026". No confidence percentage, no "merged from N emails", no "view source
  email". A number would imply we assessed you, and we didn't.
- **i18n-ready**: `<input type="date">` so the browser renders the user's own
  format, and no sentences assembled from concatenated fragments.
- Modernist as everywhere else: rules and grid, no cards, no shadows.

## Added while resolving other tickets

- **Batch the inserts.** The rebuild takes ~21s against the remote database —
  102 flight inserts plus 198 provenance links, each its own round trip. Fine
  for a worker, too slow to sit behind a form submit. From
  [Shared history rebuild module](023-shared-history-rebuild.md).
- **Rebuild after "Delete my history".** That action removes derived flights
  but keeps typed ones, which are inputs; they only reappear on the next
  rebuild, and the copy says so. Once this ticket adds a rebuild endpoint, the
  action should call it, so the flights the person entered come straight back
  instead of waiting for an import. From
  [What deletion means for data we never read](029-privacy-actions-for-typed-flights.md).
- **The picker is settled**, and its five behaviours plus three promoted
  findings are specified in
  [Choosing an airport from nine thousand](025-airport-picker.md). Build it
  fresh — the prototype variants on `prototype/airport-picker` are reference,
  not code to promote.

## Progress

Built and verified server-side; **the rendered form is not yet verified**,
because the browser lost its session and signing in is Google OAuth.

- `AirportPicker` — combobox per airport, arrows/Enter/Escape, dropdown opens
  on the person's own airports before a keystroke (handed down by the page, so
  the common case makes no request), a bare code typed blind and tabbed away
  commits, a route pasted into the origin field fills both ends, and a lone
  candidate auto-selects.
- `AddFlight` — origin/destination/date required; airline, flight number,
  times and booking reference behind a disclosure; `<input type="date">` so the
  browser renders the reader's own format. Clears the airports but keeps the
  date, because adding the return leg is the usual next action.
- `POST/PATCH/DELETE /api/manual-flights` — definer RPC then a full rebuild in
  **one transaction**, so a failed rebuild takes the write with it.
- Entry points: the Flights page, the dashboard and trips empty states
  ("Add a flight myself" beside "Import my mailbox"), and the plan step's Free
  column.
- Provenance for a typed flight reads "You added this flight yourself" — no
  tier, no version, no confidence score. Where emails later corroborate it, it
  says so, and that the person's version was kept.
- `POST /api/rebuild`, called after "delete my history" so typed flights
  reappear immediately rather than waiting for an import.

### Measured

- **Rebuild batched from ~300 round trips to 5**: 21,081ms → **1,823ms**, and
  submit-to-visible is **1,524ms**. Identical output (102 / 12 / 30 / 49).
- **Airport size class re-vendored** (migration 14; 1,169 large, 3,401 medium,
  4,234 small, 153 seaplane, 100 heliport). Searching "london" now returns
  LGW, LHR, STN (all large) first; Biggin Hill fell to 4th, London Kentucky
  and London Ontario to 6th and 7th. Personal history is hoisted above all of
  it in the browser, where the person's own airports already are.
- The write rolls back with a failing rebuild; verified by forcing one.

### A drift bug found on the way

`apps/web/app/connect/page.tsx:41` **hardcoded** the "we store" list rather
than importing it, so adding "Flights you add yourself" changed the privacy
page and `docs/privacy.md` while the consent screen kept the old three lines —
the precise drift the privacy ticket declared structurally impossible. It now
renders `WE_STORE`/`WE_NEVER_STORE` from `packages/domain`. Verified in the
browser.

### Verified in the browser, on the real history

- The picker opens on **your own airports before a keystroke** — VNO 57×,
  BLL 11×, CPH 11×, FRA 10× — with no typing and no request.
- Typing "london" puts **LTN (5×) and STN (4×) first**, then LGW and LHR
  (large), then BQH and LCY (medium), with London Kentucky and London Ontario
  last. Both promoted findings, working together, in situ.
- `VNO LHR` pasted into the From field filled **both** ends.
- `<input type="date">` rendered as `03/08/2014` in the browser's own locale.
- Saving produced the flight — 1,746 km, `Europe/Vilnius`, `source=manual`,
  confidence 1.00, correctly flagged needs-review with "No connecting or
  return leg found — we didn't guess."
- Provenance reads "You added this flight yourself", with no tier, version or
  confidence, and "There is no source email — you told us about this flight
  yourself."
- Settings shows "Of those, added by you".
- The test flight was removed afterwards and the history restored to
  102 / 12 / 30 / 49.

### Two bugs the browser found that the server tests could not

1. **A route pasted into one field left the other looking empty.**
   `AirportPicker` kept its display text in local state and never synced when
   the value arrived from outside, so the form was complete but appeared
   blank. It now syncs, showing the code (and the place, when it is one of
   yours).
2. **After a save the fields still read VNO / LHR while the button was
   disabled** — `reset()` cleared the values the parent holds but not the text
   the pickers show, which reads as filled but won't submit. The pickers are
   now remounted on reset.

### And a wording fix

A typed flight's empty fields said **"not found in source"** — a claim about
an email that never existed. On a manual flight they now read
**"you didn't say"**.
