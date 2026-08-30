-- The fourth privacy action. Separate from delete_history on purpose: every
-- other deletion there is survivable because the data can be rebuilt, and
-- these cannot be. Sweeping them into "delete my history" would make that
-- action's promise — that importing again brings your history back — false.
create or replace function public.delete_manual_flights()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare v_uid uuid := auth.uid(); v_count integer;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select count(*) into v_count from public.manual_flights where user_id = v_uid;
  delete from public.manual_flights where user_id = v_uid;

  -- Only the flights that existed *because* they were typed. A flight where a
  -- typed entry merged with real emails is still evidenced by those emails, so
  -- it survives and simply stops being attributed to the person; the next
  -- rebuild restores its extracted field values.
  delete from public.flights f
   where f.user_id = v_uid and f.source = 'manual'
     and not exists (select 1 from public.flight_sources fs where fs.flight_id = f.id);

  update public.flights set source = 'imported'
   where user_id = v_uid and source = 'manual';

  return v_count;
end; $function$;

grant execute on function public.delete_manual_flights() to authenticated;
