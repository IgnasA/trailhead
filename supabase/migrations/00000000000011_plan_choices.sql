-- The plan step after connecting: what we found, and which plan the person
-- chose. Premium is an expression of interest, not a purchase — there is no
-- billing yet, and the brief (§36) says willingness to pay is the signal
-- worth measuring before building any.
create table plan_choices (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  plan       text not null check (plan in ('free', 'premium_interest')),
  candidates integer,
  created_at timestamptz not null default now()
);

alter table plan_choices enable row level security;
create policy own_read on plan_choices for select using (user_id = auth.uid());

create or replace function public.choose_plan(p_plan text, p_candidates integer default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  insert into public.plan_choices (user_id, plan, candidates)
  values (v_uid, p_plan, p_candidates);
end; $$;

revoke all on function public.choose_plan(text, integer) from public, anon;
grant execute on function public.choose_plan(text, integer) to authenticated;
