# Trailhead — domain glossary

Trailhead reconstructs a person's flight history from their Gmail and presents
it as stats, a route map, and trips.

## Terms

- **Flight** — one flown (or to-be-flown) segment: a single departure airport,
  arrival airport, date, and carrier. The Tokyo round-trip via Frankfurt is
  four Flights. The unit of every stat and every screen. A booking/PNR is an
  attribute of a Flight, not an entity.
- **Status** (of a Flight) — `flown`, `upcoming`, `cancelled`, or
  `not_a_flight` (user-marked). Only `flown` Flights count in stats, the
  reveal, and superlatives; `upcoming` Flights appear in lists only, until
  their departure passes.
- **Source Email** — the stored record *about* an email: message id, subject,
  content hash, and classified type (confirmation / receipt / check-in /
  cancellation / marketing). Never the body — bodies are fetched live on
  demand and never persisted. "Delete my emails" deletes Source Emails;
  Flights survive it by design.
- **Extraction** — the immutable result of running one extraction tier over
  one email: a structured flight payload plus tier and confidence, stamped
  with the Extraction Version that produced it.
- **Extraction Version** — a monotonically increasing integer identifying the
  extraction pipeline's ruleset. Bumping it allows re-extraction and re-merge
  without touching prior Extractions.
- **Merge** — the deterministic step that turns Extractions into canonical
  Flights, keyed on (flight number, route, PNR), with date-change detection
  superseding rescheduled segments. Re-runnable at any time.
- **Provenance** — the audit trail on every Flight: which Source Emails it
  was merged from, the Extraction Version, and the confidence score
  (computed deterministically from tier + validation, never self-reported by
  a model). Absence of a field is information: "not found in source", never
  a guess.
- **Trip** — a derived cluster of Flights displayed as an airport chain.
  Trips are always rebuildable from Flights plus Corrections; they hold no
  independent truth.
- **Needs Review** — the state of a Flight the trip-clustering declined to
  place, together with a human-readable reason ("no return leg found and a
  9-day gap either side"). Declining to guess is the intended behavior, not
  an error.
- **Correction** — an immutable record of a user action on their data:
  assigning a Flight to a Trip, fixing a field, or marking "not a flight".
  Corrections replay over re-imports and re-merges (last write wins), and the
  set of Corrections is the labelled eval dataset for the extraction
  pipeline.
- **Import Job** — one resumable, batched run of the pipeline over a mailbox:
  search → skip cached → extract → deduplicate → reconstruct trips → build
  history. Per-item failures never abort a job; they become the reviewable
  failure list.
- **Gmail Connection** — a user's link to one Gmail mailbox. One per user in
  the MVP; modeled as its own thing so more mailboxes later is an addition,
  not a migration.
- **Disconnect** — revoking Trailhead's Gmail access (token revoked and
  destroyed). Stops all reading; deletes nothing.
- **Delete my emails** — removing all Source Emails and their Extractions.
  Flights survive; their provenance shows "source deleted".
- **Delete my history** — removing all Flights, Trips, and Corrections.
  Source Emails and Extractions survive, so history can be rebuilt without
  re-reading Gmail. Running both deletions leaves genuinely nothing derived.
- **Reference data** — public airport and airline tables (codes, names,
  coordinates, timezones) vendored into the repo; not user data. "Countries
  visited" counts ISO country codes of visited airports as-is (territories
  count separately; folding them into sovereigns is a display-time decision).
