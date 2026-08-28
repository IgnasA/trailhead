-- Called by the authenticated user right after OAuth: puts the Gmail refresh
-- token in Vault (never in a table) and records the connection. Definer so it
-- can touch vault.* while the caller only ever holds their own token.
create or replace function public.store_gmail_connection(p_email text, p_refresh_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_secret_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_refresh_token is null or length(p_refresh_token) < 10 then
    raise exception 'missing refresh token';
  end if;

  select id into v_secret_id from vault.secrets where name = 'gmail_refresh:' || v_uid;
  if v_secret_id is null then
    perform vault.create_secret(p_refresh_token, 'gmail_refresh:' || v_uid, 'Gmail refresh token');
  else
    perform vault.update_secret(v_secret_id, p_refresh_token);
  end if;

  insert into public.gmail_connections (user_id, email_address, status)
  values (v_uid, p_email, 'connected')
  on conflict (user_id, email_address) do update set status = 'connected';
end;
$$;

revoke all on function public.store_gmail_connection(text, text) from public, anon;
grant execute on function public.store_gmail_connection(text, text) to authenticated;
