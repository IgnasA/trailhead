-- Trailhead schema draft (ticket: Domain model and schema).
-- Becomes the first Supabase migration when the app scaffold exists.
-- Vocabulary: see CONTEXT.md. Posture: users read their own rows via RLS;
-- all writes go through the server/worker (service role) so invariants hold.

-- ── Reference data (public: RLS with world-read policy, service-role writes —
--    see migration 00000000000002) ──────────────────────────────────────────

create table airports (
  iata          text primary key check (iata ~ '^[A-Z]{3}$'),
  icao          text,
  name          text not null,
  municipality  text,
  iso_country   text not null,  -- ISO 3166-1 alpha-2 plus unofficial codes (XK)
  lat           double precision not null,
  lon           double precision not null,
  tz            text not null   -- IANA zone, computed once at vendor time
);

create table airlines (
  id     serial primary key,   -- IATA airline codes are recycled; not a pk
  iata   text,
  icao   text,
  name   text not null,
  source text not null default 'openflights-seed'  -- vs 'overlay'
);

-- ── User data (RLS: owner-read; writes via service role only) ───────────────

create table gmail_connections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  email_address text not null,
  status        text not null default 'connected'
                check (status in ('connected', 'disconnected')),
  history_id    text,           -- Gmail incremental-sync cursor
  created_at    timestamptz not null default now(),
  unique (user_id, email_address)
);

create table source_emails (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  gmail_message_id  text not null,
  subject           text,
  content_hash      text not null,  -- skip-cache: "412 cached, skipped"
  email_type        text not null default 'unknown'
                    check (email_type in ('confirmation', 'receipt', 'check_in',
                                          'cancellation', 'marketing', 'unknown')),
  received_at       timestamptz,
  created_at        timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

create table email_extractions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  source_email_id    uuid not null references source_emails (id) on delete cascade,
  extraction_version integer not null,
  tier               text not null check (tier in ('schema_org', 'kitinerary', 'llm')),
  payload            jsonb not null,   -- schema.org-shaped intermediate representation
  confidence         numeric(3, 2) not null check (confidence between 0 and 1),
  created_at         timestamptz not null default now(),
  unique (source_email_id, extraction_version)
);

create table trips (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,            -- "Vilnius → Tokyo → Vilnius"
  start_date date,
  end_date   date,
  created_at timestamptz not null default now()
);

create table flights (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  status             text not null default 'flown'
                     check (status in ('flown', 'upcoming', 'cancelled', 'not_a_flight')),
  airline_iata       text,
  flight_number      text,             -- "LH 710"
  origin_iata        text not null references airports (iata),
  dest_iata          text not null references airports (iata),
  departure_date     date not null,
  -- Local wall times are source truth (what the email said); UTC is derived
  -- for ordering, durations, and the flown/upcoming cutoff. All nullable:
  -- absence is information ("not found in source"), never a guess.
  dep_local          timestamp,
  dep_tz             text,
  dep_utc            timestamptz,
  arr_local          timestamp,
  arr_tz             text,
  arr_utc            timestamptz,
  distance_km        integer,          -- Haversine, computed at merge time
  booking_ref        text,
  price_amount       numeric(10, 2),
  price_currency     text,
  confidence         numeric(3, 2) not null check (confidence between 0 and 1),
  extraction_version integer not null,
  trip_id            uuid references trips (id) on delete set null,
  needs_review       boolean not null default false,
  review_reason      text,             -- human-readable "why we didn't guess"
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Provenance links: which extractions (and so which emails) built a flight.
-- count(*) per flight = the UI's "merged_from: 3 emails".
create table flight_sources (
  flight_id     uuid not null references flights (id) on delete cascade,
  extraction_id uuid not null references email_extractions (id) on delete cascade,
  primary key (flight_id, extraction_id)
);

create table corrections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null
             check (kind in ('assign_trip', 'correct_field', 'not_a_flight')),
  flight_id  uuid references flights (id) on delete set null,
  payload    jsonb not null,  -- immutable event; replays over re-imports/merges
  created_at timestamptz not null default now()
);

create table import_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  status        text not null default 'queued'
                check (status in ('queued', 'running', 'completed', 'failed')),
  stage         text not null default 'connect'
                check (stage in ('connect', 'search', 'skip_cached', 'extract',
                                 'deduplicate', 'reconstruct_trips', 'build_history')),
  counters      jsonb not null default '{}',  -- per-stage progress counters
  cursor        jsonb not null default '{}',  -- page token / historyId / batch index
  batch_current integer,
  batch_total   integer,
  started_at    timestamptz,
  finished_at   timestamptz,
  updated_at    timestamptz not null default now(),  -- worker heartbeat + Realtime key
  created_at    timestamptz not null default now()
);

create table import_failures (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references import_jobs (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  gmail_message_id text not null,
  reason           text not null,
  created_at       timestamptz not null default now()
);

-- ── Row-level security: owner-read; no insert/update/delete policies, so
--    only the service role (worker/server) writes. ──────────────────────────

alter table gmail_connections enable row level security;
alter table source_emails     enable row level security;
alter table email_extractions enable row level security;
alter table trips             enable row level security;
alter table flights           enable row level security;
alter table flight_sources    enable row level security;
alter table corrections       enable row level security;
alter table import_jobs       enable row level security;
alter table import_failures   enable row level security;

create policy own_read on gmail_connections for select using (user_id = auth.uid());
create policy own_read on source_emails     for select using (user_id = auth.uid());
create policy own_read on email_extractions for select using (user_id = auth.uid());
create policy own_read on trips             for select using (user_id = auth.uid());
create policy own_read on flights           for select using (user_id = auth.uid());
create policy own_read on corrections       for select using (user_id = auth.uid());
create policy own_read on import_jobs       for select using (user_id = auth.uid());
create policy own_read on import_failures   for select using (user_id = auth.uid());
create policy own_read on flight_sources    for select
  using (exists (select 1 from flights f
                 where f.id = flight_id and f.user_id = auth.uid()));

create index flights_user_dep       on flights (user_id, dep_utc);
create index flights_user_trip      on flights (user_id, trip_id);
create index extractions_user_email on email_extractions (user_id, source_email_id);
create index source_emails_hash     on source_emails (user_id, content_hash);
create index import_jobs_claim      on import_jobs (status, created_at);

-- Gmail refresh tokens: Supabase Vault only — no table in this schema, by design.
