# Research: Flight Email Extraction Landscape

- **Ticket:** tracker/tickets/005-flight-email-extraction-landscape.md
- **Date:** 2026-08-28
- **Question:** What already exists for turning airline emails into structured flight records, and what do the emails themselves offer? Constraint: "deterministic first, LLM only for ambiguous cases"; every record carries provenance (`source_email_id`, `extraction_version`, `confidence`, `merged_from`).

## TL;DR

1. **schema.org `FlightReservation` markup exists and is exactly our target shape, but coverage is a minority of carriers** — treat it as a high-confidence fast path, not the plan.
2. **KDE's `kitinerary` is the only serious open-source prior art** (LGPL-2.0-or-later, ships a stdin→JSON CLI). It embodies a decade of the same layered design we want: structured data → barcodes/PDF → per-vendor scripts → normalization/merge.
3. **LLM layer:** Claude structured outputs (`output_config.format` / `messages.parse()`, strict schemas) on a cheap model via the Batch API; model self-reported confidence is not trustworthy — compute `confidence` deterministically from source tier + validation.
4. **Enrichment:** no free API resolves flight number + date → times for arbitrary historical dates. Free covers airports/timezones (OurAirports, public domain) and route sanity checks (adsbdb). Paid gap-filling: AeroDataBox from $5/mo (≤210–365 days back) or FlightAware AeroAPI Standard ($100/mo min, history to 2011). The emails themselves are the primary source of times — enrichment is validation and gap-filling, not the backbone.

---

## 1. Structured markup: schema.org FlightReservation in emails

**The vocabulary.** [`schema.org/FlightReservation`](https://schema.org/FlightReservation) is explicitly designed for this: *"This type is for information about actual reservations, e.g. in confirmation emails."* Key properties: `reservationId` (PNR), `underName` (passenger), `reservationStatus`, and `reservationFor` → a [`Flight`](https://schema.org/Flight) carrying `flightNumber`, `departureAirport`/`arrivalAirport` (with IATA codes), `departureTime`/`arrivalTime`, `provider` (operating airline) and `seller` (marketing airline). This maps 1:1 onto our flight-record schema — it should *be* our canonical intermediate representation (kitinerary made the same choice, see §2).

**Why airlines emit it.** Google's [email markup program](https://developers.google.com/workspace/gmail/markup) (docs still live, updated July 2026) supports FlightReservation as JSON-LD or microdata for Gmail highlights/cards and Calendar integration. Senders must [register with Google](https://developers.google.com/workspace/gmail/markup/registering-with-google): DKIM/SPF-authenticated domain, "order of hundred emails a day minimum to Gmail" for weeks, very low spam rate. That registration bar means markup comes from the airline's own transactional sender — when present it is effectively first-party structured data, near-authoritative.

**Prevalence: minority, uneven, no public registry.** The best public evidence comes from the KItinerary maintainer, who has measured this in the wild for years: adoption *"seems to be more common with newer companies"* and varies strongly by region; his quick test is *"searching the HTML source code for `schema.org`"* ([Volker Krause, "KDE Itinerary - Data Extraction", 2018](https://www.volkerkrause.eu/2018/09/01/kde-itinerary-data-extraction.html)). Corroborating negative evidence: kitinerary ships hand-written vendor extractor scripts for many *major* carriers — American Airlines, British Airways, Air France, Air Canada, ANA, Aer Lingus, Aegean, Brussels Airlines, Condor, Air Asia, and more ([scripts directory](https://invent.kde.org/pim/kitinerary/-/tree/master/src/lib/scripts)) — i.e. for those carriers structured markup is absent or incomplete enough to need scripts. Quality also varies: KItinerary had to keep fixing its *generic* microdata handling (nested objects) against real-world markup ([Krause dev logs](https://www.volkerkrause.eu/2021/11/27/kde-itinerary-october-november-2021.html)).

**Access from Gmail.** Gmail API `users.messages.get` with `format=FULL` returns the parsed MIME payload and `format=RAW` the full RFC 2822 message base64url-encoded ([Format reference](https://developers.google.com/workspace/gmail/api/reference/rest/v1/Format)) — so the JSON-LD/microdata blocks in the HTML part are fully available to us; the Gmail message `id` is our `source_email_id`.

**Takeaway.** Build a small deterministic JSON-LD + microdata parser as extraction layer 1. Expect it to fully resolve perhaps a third of emails (newer/low-cost carriers, OTA confirmations) with near-1.0 confidence, and plan real coverage from the layers below.

## 2. Prior art

### KDE Itinerary / kitinerary (open source, the reference implementation)

Source: [project README](https://invent.kde.org/pim/kitinerary) and [Krause's extraction write-ups](https://www.volkerkrause.eu/2018/09/01/kde-itinerary-data-extraction.html), ([custom extractors](https://www.volkerkrause.eu/2018/09/08/kde-itinerary-writing-custom-extractors.html)).

- **What it is:** "Data Model and Extraction System for Travel Reservation information" — extracts from emails, PDFs, Apple Wallet passes, iCal, and ticket barcodes (IATA BCBP, UIC 918.3/9, ERA FCB/SSB, VDV, DOSIPAS) into **schema.org ontology JSON**.
- **Architecture (validates our design rule):**
  1. *Generic extractors* — schema.org JSON-LD/microdata, barcodes, PDF boarding passes, pkpass — no per-vendor code.
  2. *Vendor extractor scripts* (JavaScript) — each is a **trigger filter** (sender/DOM/barcode pattern) plus a script doing regex/XPath extraction; powerful but "very error prone, and requires manual work that scales with the amount of providers."
  3. *Post-processing* — normalization, airport/timezone augmentation from OpenStreetMap + Wikidata, **merging of elements describing the same reservation**, validation — all offline/local.
- **Reusability:** C++ library with JS extractor API, plus a CLI **`kitinerary-extractor`** that reads a document on stdin and prints schema.org JSON — available as static builds and Flatpak. Used by KDE Itinerary, KMail, and Nextcloud Mail.
- **License:** predominantly **LGPL-2.0-or-later** (repo `LICENSES/` also carries BSD-2/3-Clause, CC0-1.0, ODbL-1.0 for individual files/data). Running the CLI as a separate process keeps our codebase license-clean with zero linking concerns.

**Assessment:** the highest-leverage reuse option. Wrapping `kitinerary-extractor` as a sidecar gives us, for free, hundreds of vendor scripts, barcode/PDF decoding, and output already in our target ontology. Cost: a C++/Qt runtime dependency in the pipeline and upstream cadence we don't control — worth an early spike against a corpus of real Gmail messages.

### TripIt / Flighty (commercial, closed)

- **TripIt** ingests by users forwarding confirmations to `plans@tripit.com` or via **Inbox Sync**, which watches connected Gmail/Outlook/Yahoo inboxes and auto-imports plans ([how it works](https://www.tripit.com/web/free/how-it-works), [help: adding plans](https://help.tripit.com/en/support/solutions/articles/103000063275-adding-travel-plans-to-tripit), [Inbox Sync](https://www.tripit.com/web/blog/news-culture/automate-your-tripit-itineraries-inbox-sync)). The parser is proprietary; there is no parse-an-email API product. Their help flow ("problem with your submission") implies human/ML fallback on parse failures.
- **Flighty** imports via email forwarding, TripIt sync, or calendar scan (all Pro features), plus bulk import from FlightRadar24/OpenFlights/JetLovers exports; notably, importing flights older than one year is paywalled "due to the cost of validating and enriching historical data" ([Flighty help: importing](https://flighty.com/help/importing-flights), [managing flights](https://flighty.com/help/managing-my-flights)). That is direct commercial evidence that **historical enrichment is the expensive part**, matching §4.

### Small open-source parsers

- [`JohannesBuchner/flight-reservation-emails`](https://github.com/JohannesBuchner/flight-reservation-emails) (Python, BSD-2-Clause): schema.org parsing per Google's markup reference plus heuristic HTML parsing (EN/ES/DE). Tiny (~13 commits) and stale — useful as a reference for heuristics, not a dependency.
- Nothing else maintained surfaced; the field is effectively kitinerary vs. proprietary SaaS.

## 3. LLM extraction patterns

Facts below from Anthropic's current API documentation (via the bundled claude-api reference, cached 2026-06).

- **Schema-constrained output is a first-class API feature:** `output_config: {format: {...}}` on `messages.create()`, or preferably `client.messages.parse()` which validates the response against the schema (the older `output_format` param is deprecated). `strict: true` on tool definitions guarantees tool-input validity. Schema support includes `date-time`/`date` string formats, `enum`, `anyOf`; **not** supported: recursive schemas, `minimum`/`maximum`, `minLength`; every object needs `additionalProperties: false`. New schemas pay one-time compilation, then a 24-hour schema cache.
- **Cost shape:** extraction is a classic single-call task. Claude Haiku 4.5 is $1/$5 per MTok; the **Message Batches API runs at 50% cost** and fits inbox-backfill perfectly (results keyed by `custom_id`, not order). Escalate only ambiguous cases to a stronger model (Opus tier $5/$25). A typical airline email is ~2–5K tokens → backfill of thousands of emails is single-digit dollars on Haiku + batches.
- **Confidence:** the Claude API exposes no token logprobs, and self-reported numeric confidence from LLMs is poorly calibrated. Best practice for our `confidence` field is to compute it **deterministically, outside the model**, from: (a) extraction tier (JSON-LD ≈ 0.95+ > vendor script > LLM), (b) validation results — IATA codes resolve against the airport DB, times parse and are timezone-consistent, arrival after departure, flight number format valid, (c) cross-source agreement (multiple emails or enrichment API agree). Reserve model-emitted signals for an enum like `extraction_notes`/`ambiguities`, not the score itself.
- **Evals:** maintain a golden corpus of real (redacted) emails with hand-labeled expected records; score **field-level exact match** (airports, date, flight number) rather than whole-record; re-run the corpus on every `extraction_version` bump — the provenance field the product already carries is exactly the hook for regression-testing and selective re-extraction. Structured-outputs caveats to encode in the harness: `stop_reason: "max_tokens"` → incomplete JSON; `stop_reason: "refusal"` → output may not match schema; both must fail closed, never merge.
- **Merging multiple emails (confirmation / receipt / check-in / schedule-change) about one flight** is best done deterministically, after extraction: key on `(marketing carrier + flight number, departure date, PNR)`; merge field-wise with source-type precedence (check-in/boarding-pass beats confirmation beats receipt/marketing; latest schedule-change email wins on times); record every contributing Gmail id in `merged_from`. kitinerary's pipeline does merging in exactly this post-processing position. The LLM should classify email type (confirmation vs check-in vs cancellation vs marketing) as part of its schema, but should not be asked to merge across emails — that keeps merges reproducible.

## 4. Flight enrichment (flight number + date → times/airports)

**Free, unconditionally:**

- **[OurAirports data](https://ourairports.com/data/)** — nightly-updated CSVs (airports, runways, countries), **public domain**, mirrored on GitHub (`davidmegginson/ourairports-data`). Solves IATA→airport name/coords (join timezone via lat/lon, e.g. tz lookup lib). [OpenFlights](https://openflights.org/data) is the ODbL alternative. This covers the "airports" half of enrichment entirely for free.
- **[adsbdb](https://github.com/mrjackwills/adsbdb)** — free MIT-licensed API: callsign → route (origin/destination airports + airline). **No dates or scheduled times**, so it's a sanity-check for extracted routes, not a time source.
- **[OpenSky Network](https://openskynetwork.github.io/opensky-api/rest.html)** — cannot query by flight number/callsign at all (only icao24/airport/time-interval); REST flight data reaches back ~30 days (older data only via their researcher Trino interface); credit-limited. **Poor fit.**

**Paid / freemium, by flight number + date:**

| Provider | Free tier | Paid | Historical depth |
|---|---|---|---|
| [AeroDataBox](https://aerodatabox.com/pricing/) | 600 units/mo | **$5–$150/mo** (6K–600K units) | 210 days (mid tiers) to **365 days** |
| [aviationstack](https://aviationstack.com/pricing) | 100 req/mo (incl. historical) | from $49.99/mo (10K req) | **12-month sliding window** |
| [FlightAware AeroAPI](https://www.flightaware.com/commercial/aeroapi/) | Personal: $5/mo free credit, **no historical** | Standard **$100/mo minimum**, $0.005/result-set flight lookups | **back to 2011** (Standard+) |

**Conclusion for Trailhead:** for reconstructing *multi-year* history, only AeroAPI Standard reaches back far enough, at $100/mo minimum — and Flighty's paywall on >1-year imports confirms everyone pays for this. But the need is smaller than it looks: confirmation/check-in emails **already contain scheduled times and airports** in almost all cases. So: ship with free enrichment only (OurAirports for airport/timezone normalization and validation, adsbdb for route cross-checks); flag records missing times as low-confidence rather than buying data; if gap-filling for recent flights becomes a real need, AeroDataBox at $5–30/mo is the cheapest adequate option, and deep-history AeroAPI remains a deliberate later upgrade.

---

## Recommended extraction strategy shape

1. **Ingest:** Gmail API `messages.get` (`format=FULL`), keep the Gmail message id as `source_email_id`; cheap pre-filter (sender domain + keyword) to select candidate emails.
2. **Layer 1 — structured markup (deterministic):** parse JSON-LD `FlightReservation` (then microdata) from the HTML part into the schema.org-shaped internal record. Confidence ~0.95.
3. **Layer 2 — kitinerary sidecar (deterministic):** pipe the raw message through `kitinerary-extractor` (LGPL, separate process) to get vendor-script/PDF/barcode extraction, also in schema.org JSON. Spike this early against a real corpus; if the dependency proves too heavy, replace with a small set of home-grown per-carrier parsers for the user's top senders. Confidence ~0.8–0.9 with validation.
4. **Layer 3 — LLM fallback (ambiguous cases only):** emails where layers 1–2 yield nothing or an incomplete/invalid record go to Claude Haiku via the Batch API with a strict structured-output schema (including an email-type classification field); escalate still-ambiguous ones to a stronger model. Confidence capped lower and always gated by validation.
5. **Post-processing (deterministic, shared by all layers):** normalize; validate against OurAirports (IATA codes, timezones, temporal sanity); compute `confidence` from tier + validation; merge by `(flight, date, PNR)` with source-type precedence, filling `merged_from`; stamp `extraction_version`.
6. **Evals:** golden corpus of labeled emails, field-level scoring, run on every `extraction_version` bump; failed/low-confidence records queue for re-extraction when the version increments.

This keeps the LLM at the edge (fallback + classification), everything reproducible in the middle, and zero paid data dependencies at launch.
