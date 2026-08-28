-- start_import(): the one write a browser can cause on import_jobs — via
-- definer, for the caller's own account, idempotent per active job.
create or replace function public.start_import()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.gmail_connections
    where user_id = v_uid and status = 'connected'
  ) then
    raise exception 'no connected mailbox';
  end if;
  select id into v_job from public.import_jobs
  where user_id = v_uid and status in ('queued', 'running')
  limit 1;
  if v_job is not null then
    return v_job;
  end if;
  insert into public.import_jobs (user_id) values (v_uid) returning id into v_job;
  return v_job;
end;
$$;

revoke all on function public.start_import() from public, anon;
grant execute on function public.start_import() to authenticated;

-- Live progress: broadcast import_jobs changes (RLS still gates who sees what).
alter publication supabase_realtime add table public.import_jobs;
