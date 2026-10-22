-- Assertions for 00000000000016_security_hardening.sql. Run by
-- scripts/test-migrations.sh against a throwaway local database.
\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');
insert into public.airports (iata, name, iso_country, lat, lon, tz) values
  ('VNO', 'Vilnius', 'LT', 54.6, 25.3, 'Europe/Vilnius'),
  ('FRA', 'Frankfurt', 'DE', 50.0, 8.6, 'Europe/Berlin');

create function pg_temp.expect_error(p_sql text, p_like text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected an error matching % from: %', p_like, p_sql;
exception when others then
  if sqlerrm not like p_like then
    raise exception 'expected error matching %, got: % (from %)', p_like, sqlerrm, p_sql;
  end if;
end $$;
grant execute on function pg_temp.expect_error(text, text) to anon, authenticated;

-- store_gmail_connection records the account's own address, not the argument.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', false);
select public.store_gmail_connection('victim@example.org', 'refresh-token-alice');
reset role;
do $$ begin
  if (select array_agg(email_address) from public.gmail_connections) <> array['alice@example.com'] then
    raise exception 'store_gmail_connection used the caller-supplied email';
  end if;
  if (select decrypted_secret from vault.decrypted_secrets
      where name = 'gmail_refresh:11111111-1111-1111-1111-111111111111') <> 'refresh-token-alice' then
    raise exception 'refresh token not stored';
  end if;
end $$;

-- anon can no longer execute the manual-flight functions at all.
do $$ begin
  if has_function_privilege('anon', 'public.add_manual_flight(text, text, date, text, text, time, time, text, numeric, text)', 'execute')
     or has_function_privilege('anon', 'public.update_manual_flight(uuid, text, text, date, text, text, time, time, text, numeric, text)', 'execute')
     or has_function_privilege('anon', 'public.delete_manual_flight(uuid)', 'execute')
     or has_function_privilege('anon', 'public.delete_manual_flights()', 'execute')
     or has_function_privilege('anon', 'public.store_gmail_connection(text, text)', 'execute') then
    raise exception 'anon can still execute a definer function';
  end if;
  if not has_function_privilege('authenticated', 'public.add_manual_flight(text, text, date, text, text, time, time, text, numeric, text)', 'execute') then
    raise exception 'authenticated lost add_manual_flight';
  end if;
end $$;

-- Ownership still holds: Bob can't change or delete Alice's flight.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', false);
select public.add_manual_flight('VNO', 'FRA', '2024-03-09') as alice_flight \gset
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', false);
select pg_temp.expect_error(format(
  $q$select public.update_manual_flight(%L, 'FRA', 'VNO', '2024-03-10')$q$, :'alice_flight'), '%no such manual flight%');
select pg_temp.expect_error(format(
  $q$select public.delete_manual_flight(%L)$q$, :'alice_flight'), '%no such manual flight%');
-- And free text is bounded in the table too.
select pg_temp.expect_error(
  $q$select public.add_manual_flight('VNO', 'FRA', '2024-03-09', null, null, null, null, repeat('x', 33))$q$,
  '%manual_flights_text_bounds%');
reset role;

do $$ begin
  if (select count(*) from public.manual_flights) <> 1 then
    raise exception 'expected exactly Alice''s one flight';
  end if;
  if not exists (select 1 from pg_proc where proname = 'add_manual_flight'
                 and proconfig @> array['search_path=public, pg_temp']) then
    raise exception 'add_manual_flight search_path not pinned';
  end if;
end $$;

\echo 'security_hardening: all assertions passed'
