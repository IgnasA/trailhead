# Travel Intelligence SaaS — AI Agent Project Brief

> Recovered 2026-08-28 from the Claude Design project's `uploads/` folder
> (`uploads/travel-intelligence-ai-agent-brief.md`) — the §-numbered brief the
> MVP wireframes' annotations cite. Where this brief and the wayfinder map's
> resolved decisions differ, the map's decisions (made later, with research)
> govern; the deltas are listed in tracker ticket 001.

## 1. Project Overview

Build a consumer SaaS product that automatically reconstructs a user's historical travel history from their Gmail account.

Core promise:

> **Connect your Gmail and see everywhere you've ever travelled.**

The initial product focuses exclusively on flights. The system scans a user's mailbox, identifies flight-related emails, extracts structured flight information, validates and normalizes it, deduplicates records, reconstructs trips, and presents the result in a polished travel analytics dashboard.

The product should feel closer to **"Spotify Wrapped for your travel history"** than to a generic email parser or flight tracker.

---

## 2. Primary Goal

Build and validate a working MVP that can:

1. Authenticate a user with Google.
2. Obtain the minimum Gmail permissions required.
3. Search the user's mailbox for potentially flight-related emails.
4. Retrieve and normalize candidate emails.
5. Determine whether an email contains flight information.
6. Extract structured flight data using an LLM.
7. Validate LLM output using strict schemas.
8. Normalize airports, airlines, dates, currencies, and identifiers.
9. Deduplicate flights from repeated emails.
10. Reconstruct logical trips from individual flights.
11. Display a beautiful travel dashboard.
12. Let users inspect why a flight was extracted and trace it back to its source email.
13. Let users disconnect Gmail and delete their imported data.

Do NOT expand the MVP into hotels, restaurants, car rentals, mobile apps, or complex expense tracking until flight extraction and the core experience are validated with real users.

---

# 3. Product Vision

Long-term vision:

> **A personal travel intelligence layer that reconstructs a person's entire travel history from the data they already have.**

Potential future data sources:

- Gmail
- Outlook
- Google Calendar
- Apple Calendar
- hotel confirmations
- car rentals
- train bookings
- travel receipts
- manually added trips

Potential future features:

- complete trip reconstruction
- hotel history
- travel spending
- yearly Travel Wrapped
- travel timeline
- country/city statistics
- travel recommendations based on history
- upcoming trip detection
- mobile application
- privacy-first local processing

These are future directions, not MVP requirements.

---

# 4. Target User

Initial target:

- Frequent or moderately frequent travelers
- People with several years of Gmail history
- People who have accumulated flight confirmations, itineraries, receipts, and boarding passes
- Users who enjoy statistics, maps, personal analytics, and travel memories

The ideal reaction after importing data:

> "I had no idea I had travelled that much."

The product should create a strong visual "wow" moment immediately after import.

---

# 5. MVP User Journey

## Landing

Headline:

> **See everywhere you've ever travelled.**

Supporting message:

> Connect Gmail and automatically reconstruct your flight history.

Primary CTA:

> **Connect Gmail**

---

## Authentication

Use Google OAuth.

Keep Gmail permissions as narrow as possible.

Do not request broad permissions without a concrete product requirement.

---

## Import

Show clear progress:

```text
Connecting to Gmail...
✓ Connected

Searching your mailbox...
✓ Found candidate emails

Extracting flights...
✓ 132 flights detected

Building your travel history...
✓ 47 countries
✓ 91 airports

Your travel history is ready.
```

Avoid fake progress. Progress indicators should reflect actual work where possible.

---

## Dashboard

The first dashboard should prominently show:

```text
132 flights
47 countries
91 airports
312,482 km
14 airlines
```

Then:

- interactive world map
- travel timeline
- trips
- countries
- airlines
- airports
- recent flights

---

# 6. Recommended Technology Stack

## Frontend

- Next.js
- TypeScript
- React
- Tailwind CSS
- shadcn/ui

Use strict TypeScript.

Avoid unnecessary frontend state management until real complexity requires it.

---

## Backend

Initially use Next.js server-side functionality.

Do not introduce a separate backend service unless there is a clear need.

---

## Database

Use PostgreSQL through Supabase.

Use migrations for schema changes.

Never rely on manually changing production tables.

---

## Authentication

Supabase Auth and/or Google OAuth depending on the final architecture.

Gmail authorization must be handled securely server-side.

---

## AI

Use an LLM for:

1. email classification
2. structured flight extraction
3. ambiguous trip reconstruction

Do NOT use an LLM for tasks that can be performed deterministically.

Examples of deterministic tasks:

- sorting flights
- deduplication
- date comparisons
- airport lookup
- distance calculations
- country lookup
- aggregations
- statistics

Principle:

> **Deterministic code for deterministic problems. LLMs for semantic ambiguity.**

---

## Validation

Use Zod for every external/LLM response.

Never trust raw LLM output.

---

## Maps

Use a map library such as MapLibre.

The map should visualize:

- airports
- flight routes
- countries visited

Avoid overengineering geographic features during the MVP.

---

# 7. High-Level Architecture

```text
                    Google Gmail
                         │
                         ▼
                  Gmail OAuth/API
                         │
                         ▼
                  Message Discovery
                         │
                         ▼
                Candidate Email Store
                         │
                         ▼
                 Email Normalization
                         │
                         ▼
                Flight Classification
                         │
                         ▼
                LLM Flight Extraction
                         │
                         ▼
                    Zod Validation
                         │
                         ▼
                Data Normalization
                         │
                         ▼
                    Deduplication
                         │
                         ▼
                  Flight Database
                         │
                         ▼
                  Trip Reconstruction
                         │
                         ▼
                 Travel Intelligence DB
                         │
                         ▼
                    Web Dashboard
```

---

# 8. Core Engineering Principle

Separate these concerns:

```text
Gmail ingestion
      ↓
raw candidate emails
      ↓
AI extraction
      ↓
normalized domain objects
      ↓
trip intelligence
      ↓
presentation
```

Do not couple Gmail-specific logic directly to React components.

Do not put AI prompts inside UI components.

Do not mix database queries with extraction logic.

---

# 9. Suggested Repository Structure

```text
src/
  app/
    (auth)/
    dashboard/
    settings/

  components/
    ui/
    layout/
    map/

  features/
    gmail/
    flights/
    trips/
    dashboard/
    onboarding/

  lib/
    gmail/
    ai/
    database/
    airports/
    airlines/
    dates/

  schemas/
    flight.ts
    email.ts
    trip.ts

  services/
    gmail-service.ts
    email-classifier.ts
    flight-extractor.ts
    flight-normalizer.ts
    flight-deduplicator.ts
    trip-builder.ts

  tests/
    fixtures/
    extraction/
    normalization/
    deduplication/
    trips/
```

Keep domain logic in services/pure functions rather than large React components.

---

# 10. Database Model

Initial entities:

## users

```text
id
created_at
```

---

## source_emails

Stores metadata about emails used for extraction.

```text
id
user_id
gmail_message_id
thread_id
subject
sender
received_at
message_hash
raw_content_reference
created_at
```

Avoid storing more email content than is actually needed.

---

## flights

```text
id
user_id

airline_code
airline_name

flight_number

departure_airport_code
arrival_airport_code

departure_at
arrival_at

booking_reference

price
currency

source_email_id

confidence

extraction_model
extraction_version

created_at
updated_at
```

---

## airports

```text
iata_code
name
city
country
latitude
longitude
```

---

## trips

```text
id
user_id
name

start_date
end_date

start_airport_code
end_airport_code

created_at
updated_at
```

---

## trip_flights

```text
trip_id
flight_id
sequence
```

---

# 11. Critical Data Provenance

Every extracted flight should be traceable back to its source.

Store:

```text
source_email_id
extraction_model
extraction_version
confidence
```

Example:

```text
flight
  source_email_id: gmail_abc123
  extraction_model: <model>
  extraction_version: 3
  confidence: 0.98
```

This is critical for:

- debugging
- user trust
- reprocessing
- improving prompts
- evaluating models
- handling incorrect extraction

The user should eventually be able to click:

> "View source"

and inspect the relevant email.

---

# 12. AI Extraction Contract

The LLM should receive a narrow task.

Do NOT ask:

> "Analyze this email and understand the user's travel history."

Instead:

> "Determine whether this email contains flight information and, if so, extract the following fields."

Example schema:

```ts
const FlightExtractionSchema = z.object({
  isFlightEmail: z.boolean(),

  airline: z.string().nullable(),
  flightNumber: z.string().nullable(),

  departureAirport: z.string().nullable(),
  arrivalAirport: z.string().nullable(),

  departureTime: z.string().nullable(),
  arrivalTime: z.string().nullable(),

  bookingReference: z.string().nullable(),

  price: z.number().nullable(),
  currency: z.string().nullable(),

  confidence: z.number().min(0).max(1),
});
```

The exact schema can evolve.

Prefer structured output/function calling where supported.

---

# 13. AI Rules

The model must:

- never invent missing information
- return `null` when a field is unavailable
- distinguish confirmed data from inferred data
- preserve source values when uncertain
- avoid guessing airport codes
- avoid guessing dates
- avoid guessing prices
- provide confidence
- classify non-flight emails as non-flight emails

If the email says:

```text
Vilnius Airport
```

do not automatically assume a particular flight unless the email supports it.

Normalization can happen after extraction.

---

# 14. Extraction Pipeline

Use this pipeline:

```text
Email
  ↓
HTML/text normalization
  ↓
Candidate classification
  ↓
LLM extraction
  ↓
Schema validation
  ↓
Normalization
  ↓
Confidence evaluation
  ↓
Deduplication
  ↓
Database
```

Do not make a single LLM call responsible for all of these tasks.

---

# 15. Candidate Email Discovery

First reduce the search space.

Use Gmail search queries and deterministic heuristics to identify likely travel emails.

Potential terms:

```text
flight
itinerary
boarding pass
booking confirmation
reservation
departure
arrival
flight number
booking reference
```

Add airline-specific patterns later.

Important:

> Do not send the user's entire mailbox to an LLM.

Only process likely candidates.

---

# 16. Email Normalization

Flight emails can contain:

- HTML
- tables
- tracking pixels
- CSS
- duplicated text
- mobile/desktop versions
- quoted replies
- signatures

Create a normalization layer that produces clean text while preserving useful structure.

Do not destroy important values such as:

- flight number
- airport codes
- dates
- times
- booking reference
- price

---

# 17. Deduplication

The same flight may appear in:

- booking confirmation
- payment receipt
- itinerary update
- check-in email
- boarding pass
- reminder email

These must not become multiple flights.

Create deterministic deduplication logic based on combinations such as:

```text
user
+
airline
+
flight number
+
departure date
+
departure airport
+
arrival airport
```

Use booking reference as an additional signal when available.

Do not rely solely on LLM judgment for deduplication.

---

# 18. Normalization

Normalize:

### Airports

Convert variants such as:

```text
Vilnius Airport
Vilnius International Airport
VNO
```

into:

```text
VNO
```

Use a canonical airport dataset.

---

### Airlines

Normalize aliases into canonical entities.

Example:

```text
Ryanair DAC
Ryanair
FR
```

→ canonical airline entity.

---

### Dates

Store timestamps in UTC where appropriate, while retaining the airport's local timezone information when needed.

Be extremely careful with date-only values.

---

# 19. Trip Reconstruction

Flights are the atomic data.

Trips are derived data.

Example:

```text
VNO → FRA
FRA → JFK
JFK → FRA
FRA → VNO
```

can become:

```text
Trip:
Vilnius → New York → Vilnius
```

Use deterministic clustering first.

Possible signals:

- temporal proximity
- airport continuity
- geographic continuity
- return flights
- long gaps

Use an LLM only for ambiguous cases.

Do not make the trip model dependent on an LLM for every user.

---

# 20. Flight Distance

Calculate great-circle distance using airport coordinates.

Do not ask an LLM to calculate distances.

Use a deterministic formula such as Haversine.

Store the calculated value or calculate it on demand.

---

# 21. Dashboard Requirements

The dashboard should be visually impressive but technically simple.

## KPI section

Show:

- total flights
- countries
- airports
- total distance
- airlines
- optionally estimated spend

---

## Map

Show:

- visited airports
- flight routes
- filters by year
- optional filters by airline

Do not overload the map with every possible statistic.

---

## Timeline

Display flights/trips chronologically.

Allow filtering by year.

---

## Countries

Show:

- countries visited
- number of trips
- first visit
- last visit

---

## Airlines

Show:

- number of flights
- distance
- optional spending

---

## Airports

Show:

- departures
- arrivals
- total activity

---

# 22. Visual Design Direction

The product should feel:

- premium
- modern
- calm
- data-rich
- travel-oriented
- slightly playful

Avoid:

- generic SaaS gradients
- excessive glassmorphism
- huge rounded cards everywhere
- excessive animations
- generic AI dashboard aesthetics

Think:

> **Apple Travel + Linear + Strava + Spotify Wrapped**

rather than:

> generic admin dashboard.

The data itself should be the visual hero.

---

# 23. AI Development Workflow

The AI coding agent should work incrementally.

Never attempt to implement the entire product in one prompt.

Preferred workflow:

```text
Architecture decision
      ↓
Small implementation task
      ↓
Tests
      ↓
Run lint/typecheck
      ↓
Review diff
      ↓
Fix issues
      ↓
Commit
      ↓
Next task
```

Each implementation task should ideally be small enough to review comfortably.

---

# 24. Agent Rules

Before modifying code:

1. Inspect the existing project.
2. Understand the current architecture.
3. Reuse existing utilities.
4. Do not create duplicate abstractions.
5. Check existing tests.
6. Make the smallest reasonable change.

After modifying code:

1. Run TypeScript checks.
2. Run lint.
3. Run relevant tests.
4. Fix failures.
5. Summarize exactly what changed.
6. Mention any assumptions.

Never claim something was tested if it was not actually tested.

---

# 25. TypeScript Rules

Use strict TypeScript.

Avoid:

```ts
any
```

unless there is a compelling, documented reason.

Prefer:

```ts
unknown
```

plus runtime validation.

All external data must be validated.

External sources include:

- Gmail API
- LLM output
- database records
- URL parameters
- user input

---

# 26. Error Handling

Errors should be explicit.

Examples:

```text
Gmail authorization failed
Gmail API unavailable
Email could not be parsed
LLM extraction failed
LLM returned invalid data
Airport could not be normalized
Database write failed
```

Do not silently swallow errors.

For batch processing, one broken email should not abort the entire import.

Use per-item failure tracking.

---

# 27. Import Jobs

Mailbox imports can involve many emails.

Do not make a single HTTP request process thousands of messages synchronously.

Design the import flow so it can eventually support:

```text
Import Job
  ├── discover emails
  ├── process batch 1
  ├── process batch 2
  ├── process batch 3
  └── finalize
```

The MVP can start simple, but keep the architecture extensible.

---

# 28. AI Cost Control

LLM calls are expensive compared with deterministic processing.

Use:

```text
Gmail search
   ↓
heuristics
   ↓
cheap classification
   ↓
LLM extraction only when needed
```

Avoid processing the same email repeatedly.

Cache extraction results.

Use:

```text
message_hash
+
extraction_version
+
model
```

to determine whether an email needs reprocessing.

---

# 29. AI Evaluation Dataset

This is a high-priority engineering task.

Create a test fixture containing approximately 100 real-world-style flight emails.

Include:

- Ryanair
- Wizz Air
- Lufthansa
- LOT
- Turkish Airlines
- easyJet
- booking platforms
- receipts
- boarding passes
- itinerary changes
- cancellation emails
- non-flight travel emails
- duplicate emails
- messy HTML
- multilingual content where relevant

Each fixture should have expected structured output.

Example:

```text
tests/fixtures/flights/
  ryanair-001.html
  ryanair-002.html
  wizzair-001.html
  lufthansa-001.html
```

Then run the extraction pipeline against the dataset.

Track:

- classification accuracy
- airport accuracy
- airline accuracy
- flight number accuracy
- date accuracy
- price accuracy
- duplicate detection accuracy

This dataset is more valuable than repeatedly tweaking prompts manually.

---

# 30. Privacy Requirements

Privacy is a core product requirement.

The system handles potentially sensitive email data.

Principles:

- request minimum Gmail permissions
- minimize stored email content
- encrypt sensitive data where appropriate
- never expose one user's email data to another user
- provide Gmail disconnect
- provide account/data deletion
- document what data is stored
- document how AI processing works
- do not use user email content for model training without explicit appropriate consent/legal basis
- avoid unnecessary logging of email contents

Before public launch, review Google's current OAuth/Gmail policies and applicable privacy/security requirements.

Do not treat privacy/legal compliance as a later cosmetic task.

---

# 31. Source Email Handling

Prefer storing:

```text
gmail_message_id
```

rather than permanently storing the entire email body when it is not needed.

If source content must be retained for debugging or user inspection, explicitly justify and protect it.

Design the system so imported email content can be deleted without deleting the derived travel history.

---

# 32. Security

Never:

- expose Google access tokens to the client unnecessarily
- log OAuth tokens
- log complete email bodies in production logs
- trust client-provided user IDs
- trust LLM output without validation
- expose source emails across accounts

Use server-side authorization checks for every user-owned resource.

---

# 33. Testing Strategy

Prioritize:

### Unit tests

- email normalization
- airport normalization
- airline normalization
- deduplication
- distance calculation
- trip reconstruction

### AI evaluation

- extraction fixtures
- regression tests
- malformed responses
- missing fields

### Integration tests

- Gmail import flow
- database persistence
- authentication boundaries

### E2E

Eventually test:

```text
sign in
→ connect Gmail
→ import
→ dashboard
```

Do not overbuild E2E tests before the core domain logic is stable.

---

# 34. MVP Milestones

## Milestone 1 — Foundation

- project initialized
- deployment working
- database working
- authentication working
- project documentation created

---

## Milestone 2 — Gmail

- OAuth
- Gmail API integration
- search
- message retrieval
- normalization

Success criteria:

> Can retrieve and display candidate emails from the user's Gmail.

---

## Milestone 3 — AI extraction

- extraction schema
- prompt
- LLM integration
- Zod validation
- confidence
- extraction persistence

Success criteria:

> Can reliably extract useful flight data from a representative dataset.

---

## Milestone 4 — Data quality

- airport normalization
- airline normalization
- deduplication
- source provenance
- extraction versioning

Success criteria:

> Same real-world flight does not appear multiple times.

---

## Milestone 5 — Travel intelligence

- distance calculation
- trip reconstruction
- country statistics
- airline statistics
- airport statistics

---

## Milestone 6 — Dashboard

- KPIs
- world map
- timeline
- flights
- trips
- filters

Success criteria:

> A user can import their history and immediately understand it visually.

---

## Milestone 7 — Productization

- onboarding
- error states
- Gmail disconnect
- data deletion
- privacy page
- billing
- usage limits
- analytics
- feedback

---

# 35. What NOT to Build Yet

Do not build initially:

- native iOS app
- native macOS app
- Android app
- hotel extraction
- Airbnb integration
- train integration
- car rental integration
- social features
- complex recommendation engine
- AI travel chatbot
- loyalty program integrations
- advanced expense accounting
- complicated notification system

The goal is to validate:

> **Can we automatically reconstruct a user's flight history well enough that they love seeing it?**

---

# 36. Business Validation

The first objective is not revenue.

The first objective is:

> **People connect their Gmail and genuinely value the resulting travel history.**

Initial target:

- 20–50 external users

Measure:

- connection rate
- successful import rate
- extraction accuracy
- dashboard completion rate
- return visits
- number of corrections
- willingness to pay

Ask:

> "Would you pay €30/year for this?"

Do not rely on:

> "Do you like it?"

Behavior is more useful than compliments.

---

# 37. Initial Pricing Hypothesis

Possible model:

### Free

- historical flight import
- basic map
- basic statistics

### Premium

Approximately:

```text
€4–6/month
or
€30–40/year
```

Potential premium features:

- automatic synchronization
- unlimited history
- trip reconstruction
- spending analysis
- advanced statistics
- Travel Wrapped
- hotels and other travel data

Pricing is a hypothesis and must be validated.

---

# 38. Long-Term Differentiator

Do not position the company as:

> "A flight tracker."

Position it as:

> **"Automatically reconstruct your entire travel history from the data you already have."**

The key differentiator is **zero manual entry**.

The product should transform messy historical data into something meaningful and beautiful.

---

# 39. Potential "Magic Moment"

After import, generate a summary such as:

```text
YOUR TRAVEL HISTORY

2019 → 2026

132 flights
47 countries
91 airports
312,482 km
14 airlines

Most visited country
Italy — 7 trips

Most used airline
Ryanair — 31 flights

Longest flight
Vilnius → Tokyo

Busiest year
2025 — 29 flights
```

Then show the world map.

This is the emotional product moment.

---

# 40. Future "Travel Wrapped"

Potential annual product:

```text
YOUR 2026 TRAVEL WRAPPED

You flew 31 times.

🌍 11 countries
🛫 24 airports
✈️ 7 airlines
📏 74,821 km
💰 €4,812

Your most visited country:
Italy

Your most used airline:
Ryanair

Your longest journey:
Vilnius → Tokyo

Your busiest month:
June
```

This could become a strong retention and sharing feature.

---

# 41. Product Philosophy

Follow these principles:

1. **Automatic over manual.**
2. **Useful over technically impressive.**
3. **Deterministic code over unnecessary AI.**
4. **Small composable services over giant functions.**
5. **Data provenance over black-box results.**
6. **Privacy by design.**
7. **Beautiful visualization is part of the product, not decoration.**
8. **Validate with real users early.**
9. **Do not overbuild before validation.**
10. **Every AI-generated result must be treated as untrusted external input.**

---

# 42. Recommended Build Order

The preferred implementation order is:

```text
1. Repository + project instructions
2. Database schema
3. Authentication
4. Gmail OAuth
5. Gmail search
6. Gmail message retrieval
7. Email normalization
8. Flight extraction schema
9. LLM extraction
10. Extraction tests
11. Airport/airline normalization
12. Deduplication
13. Flight persistence
14. Trip reconstruction
15. Distance calculation
16. Dashboard KPIs
17. Map
18. Timeline
19. Filters
20. Source email inspection
21. Error handling
22. Import progress
23. Data deletion/disconnect
24. Privacy/security hardening
25. Billing
26. Launch
```

Do not reorder these significantly without a concrete reason.

---

# 43. How the AI Agent Should Communicate

When asked to implement something:

1. Briefly state what you understand.
2. Inspect relevant existing files.
3. Identify the smallest implementation.
4. Implement it.
5. Run relevant checks/tests.
6. Fix failures.
7. Report:
   - files changed
   - behavior added
   - tests/checks run
   - known limitations

Avoid long explanations before implementation.

When requirements are ambiguous, prefer the simplest interpretation consistent with this document.

Do not invent product requirements.

---

# 44. Definition of Done

A feature is not complete merely because the code compiles.

A feature is complete when:

- implementation exists
- types are correct
- external data is validated
- errors are handled
- relevant tests exist
- lint passes
- typecheck passes
- behavior is manually reviewed when UI is involved
- security/privacy implications have been considered
- no unnecessary abstraction was introduced

---

# 45. First Task for the Agent

Start by inspecting the repository.

Do NOT immediately write application code.

Determine:

1. Current framework
2. Current package manager
3. Existing dependencies
4. Existing database setup
5. Existing authentication
6. Existing environment variables
7. Existing project structure
8. Existing tests
9. Existing UI components
10. Deployment configuration

Then propose the smallest set of changes required to establish the foundation described in this document.

If the repository is empty, initialize the project according to the recommended stack.

Do not implement Gmail or AI extraction until the foundation is understood and working.

---

# 46. Important Constraint

This is a **solo-founder MVP**.

Optimize for:

- speed
- maintainability
- low infrastructure complexity
- low operational cost
- strong user experience
- LLM-assisted development
- ability to validate the business quickly

Avoid enterprise architecture unless it solves an actual MVP problem.

The best architecture is not the most sophisticated one.

The best architecture is the simplest one that allows the product to reach real users quickly while preserving a clean path to scale.
