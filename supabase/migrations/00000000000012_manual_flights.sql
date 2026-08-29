-- Manual flights: the third truth source, alongside Extractions and
-- Corrections. Flights are rebuilt from scratch on every import, so anything
-- that must survive a rebuild has to be an *input* to it — a typed flight
-- stored in `flights` would be destroyed by the next `delete from flights`.
--
-- It is not a Correction either: CONTEXT.md defines a Correction as an action
-- on a Flight, and the correction set is the extractor's labelled eval
-- dataset. A flight you typed is not an example of an extraction being wrong.

create table manual_flights (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  -- Required: there is no flight *schedule* reference data in this system, so
  -- "LH710 on the 3rd" genuinely cannot be resolved into a route.
  origin_iata    text not null references airports (iata),
  dest_iata      text not null references airports (iata),
  departure_date date not null,
  -- Everything below is optional and stays optional. Absence is information
  -- here exactly as it is for an extraction: "not stated", never a guess.
  -- airline_iata is not a foreign key because IATA airline codes are recycled
  -- and `airlines.iata` is deliberately not unique.
  airline_iata   text check (airline_iata ~ '^[A-Z0-9]{2}$'),
  flight_number  text,
  dep_local_time time,              -- local wall time, as the person knows it
  arr_local_time time,
  booking_ref    text,
  price_amount   numeric(10, 2),
  price_currency text check (price_currency ~ '^[A-Z]{3}$'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint different_airports check (origin_iata <> dest_iata)
);

create index manual_flights_user on manual_flights (user_id);

-- Which truth source produced a Flight. The UI branches on this: a typed
-- flight shows "You added this on …" rather than a confidence percentage.
alter table flights
  add column source text not null default 'imported'
  check (source in ('imported', 'manual'));

alter table manual_flights enable row level security;
create policy own_read on manual_flights for select using (user_id = auth.uid());

-- ── Write path ──────────────────────────────────────────────────────────────
-- Definer functions, as everywhere else: the table is owner-read, and every
-- write goes through a function that can only touch the caller's own rows.

create or replace function public.add_manual_flight(
  p_origin          text,
  p_dest            text,
  p_departure_date  date,
  p_airline         text default null,
  p_flight_number   text default null,
  p_dep_local_time  time default null,
  p_arr_local_time  time default null,
  p_booking_ref     text default null,
  p_price_amount    numeric default null,
  p_price_currency  text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- NOT a paywall. Manual entry is ungated on every tier; a cap would
  -- right-truncate the only measurement the feature can produce. This stops a
  -- runaway script, and a real person reaching it is a finding worth acting
  -- on rather than a limit worth enforcing.
  select count(*) into v_count from manual_flights where user_id = auth.uid();
  if v_count >= 50 then
    raise exception 'manual_flight_limit';
  end if;

  insert into manual_flights (
    user_id, origin_iata, dest_iata, departure_date, airline_iata,
    flight_number, dep_local_time, arr_local_time, booking_ref,
    price_amount, price_currency
  ) values (
    auth.uid(), upper(p_origin), upper(p_dest), p_departure_date, upper(p_airline),
    p_flight_number, p_dep_local_time, p_arr_local_time, p_booking_ref,
    p_price_amount, upper(p_price_currency)
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.update_manual_flight(
  p_id              uuid,
  p_origin          text,
  p_dest            text,
  p_departure_date  date,
  p_airline         text default null,
  p_flight_number   text default null,
  p_dep_local_time  time default null,
  p_arr_local_time  time default null,
  p_booking_ref     text default null,
  p_price_amount    numeric default null,
  p_price_currency  text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update manual_flights set
    origin_iata    = upper(p_origin),
    dest_iata      = upper(p_dest),
    departure_date = p_departure_date,
    airline_iata   = upper(p_airline),
    flight_number  = p_flight_number,
    dep_local_time = p_dep_local_time,
    arr_local_time = p_arr_local_time,
    booking_ref    = p_booking_ref,
    price_amount   = p_price_amount,
    price_currency = upper(p_price_currency),
    updated_at     = now()
  where id = p_id and user_id = auth.uid();

  if not found then
    raise exception 'no such manual flight';
  end if;
end;
$$;

create or replace function public.delete_manual_flight(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from manual_flights where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'no such manual flight';
  end if;
end;
$$;

grant execute on function public.add_manual_flight(
  text, text, date, text, text, time, time, text, numeric, text) to authenticated;
grant execute on function public.update_manual_flight(
  uuid, text, text, date, text, text, time, time, text, numeric, text) to authenticated;
grant execute on function public.delete_manual_flight(uuid) to authenticated;
