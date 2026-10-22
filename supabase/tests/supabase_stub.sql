-- Just enough of a Supabase project for the migrations to apply to a bare
-- local Postgres: the API roles, auth.uid()/auth.users, a plaintext vault, and
-- the realtime publication. Test scaffolding only — never apply to a project.
-- Roles are cluster-wide, so they may exist from an earlier run.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;

create schema vault;
create table vault.secrets (
  id uuid primary key default gen_random_uuid(), name text unique, secret text, description text);
create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
create function vault.create_secret(p_secret text, p_name text, p_description text) returns uuid
language sql as $$ insert into vault.secrets (name, secret, description)
  values (p_name, p_secret, p_description) returning id $$;
create function vault.update_secret(p_id uuid, p_secret text) returns void
language sql as $$ update vault.secrets set secret = p_secret where id = p_id $$;

create publication supabase_realtime;
