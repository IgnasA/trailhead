-- Security review hardening (docs/SECURITY_REVIEW.md).
--
-- 1. store_gmail_connection trusted its p_email argument. It is callable by
--    any signed-in user straight through PostgREST, so someone could record an
--    arbitrary address as "their" mailbox — and the worker sends the import
--    completion email to that address. The address now comes from the
--    verified auth.users row; p_email stays in the signature so existing
--    callers keep working, and is ignored.
create or replace function public.store_gmail_connection(p_email text, p_refresh_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_secret_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_refresh_token is null or length(p_refresh_token) < 10 or length(p_refresh_token) > 2048 then
    raise exception 'missing refresh token';
  end if;

  select email into v_email from auth.users where id = v_uid;
  if v_email is null then
    raise exception 'account has no email';
  end if;

  select id into v_secret_id from vault.secrets where name = 'gmail_refresh:' || v_uid;
  if v_secret_id is null then
    perform vault.create_secret(p_refresh_token, 'gmail_refresh:' || v_uid, 'Gmail refresh token');
  else
    perform vault.update_secret(v_secret_id, p_refresh_token);
  end if;

  insert into public.gmail_connections (user_id, email_address, status)
  values (v_uid, v_email, 'connected')
  on conflict (user_id, email_address) do update set status = 'connected';
end;
$$;

revoke all on function public.store_gmail_connection(text, text) from public, anon;
grant execute on function public.store_gmail_connection(text, text) to authenticated;

-- 2. The manual-flight functions (migrations 12 and 13) never revoked the
--    default PUBLIC execute grant, so the anon role could call them. Each one
--    checks auth.uid() and fails closed today; this removes the reliance on
--    that, matching every other definer function in the schema.
revoke all on function public.add_manual_flight(
  text, text, date, text, text, time, time, text, numeric, text) from public, anon;
revoke all on function public.update_manual_flight(
  uuid, text, text, date, text, text, time, time, text, numeric, text) from public, anon;
revoke all on function public.delete_manual_flight(uuid) from public, anon;
revoke all on function public.delete_manual_flights() from public, anon;

grant execute on function public.add_manual_flight(
  text, text, date, text, text, time, time, text, numeric, text) to authenticated;
grant execute on function public.update_manual_flight(
  uuid, text, text, date, text, text, time, time, text, numeric, text) to authenticated;
grant execute on function public.delete_manual_flight(uuid) to authenticated;
grant execute on function public.delete_manual_flights() to authenticated;

-- 3. The same three definer functions ran with search_path = public, which
--    leaves pg_temp searched first for relations. Pin it last.
alter function public.add_manual_flight(
  text, text, date, text, text, time, time, text, numeric, text) set search_path = public, pg_temp;
alter function public.update_manual_flight(
  uuid, text, text, date, text, text, time, time, text, numeric, text) set search_path = public, pg_temp;
alter function public.delete_manual_flight(uuid) set search_path = public, pg_temp;

-- 4. Free text on a typed flight had no bound in the database either; the API
--    now limits it, and so does the table. NOT VALID: existing rows are not
--    re-checked, so this cannot fail on data already stored.
alter table public.manual_flights
  add constraint manual_flights_text_bounds check (
    length(flight_number) <= 16 and length(booking_ref) <= 32
  ) not valid;
