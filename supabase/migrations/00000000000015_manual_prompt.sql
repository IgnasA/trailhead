-- The counting-not-capping ticket: manual entry is never walled, but the
-- eleventh flight is a strong signal, and it is asked about exactly once.
-- The answer lands in plan_choices either way — "not now" is itself signal,
-- and a dismissal has to be remembered server-side or the prompt nags.
alter table plan_choices drop constraint plan_choices_plan_check;
alter table plan_choices add constraint plan_choices_plan_check
  check (plan in ('free', 'premium_interest', 'premium_not_now'));

-- Where the choice was made: the plan step, or the prompt past ten manual
-- flights. Distinguishable, but countable together.
alter table plan_choices add column context text not null default 'plan_step'
  check (context in ('plan_step', 'manual_flights'));

drop function public.choose_plan(text, integer);
create or replace function public.choose_plan(
  p_plan text, p_candidates integer default null, p_context text default 'plan_step'
) returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  insert into public.plan_choices (user_id, plan, candidates, context)
  values (v_uid, p_plan, p_candidates, p_context);
end; $$;

revoke all on function public.choose_plan(text, integer, text) from public, anon;
grant execute on function public.choose_plan(text, integer, text) to authenticated;
