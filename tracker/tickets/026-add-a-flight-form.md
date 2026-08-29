---
title: The add-a-flight form
label: wayfinder:task
status: open
assignee:
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
