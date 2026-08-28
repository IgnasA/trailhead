-- Reference data is world-readable by design (schema ticket), but must not
-- be anon-writable: enable RLS with a public read policy; writes stay
-- service-role only (the vendoring script).
alter table airports enable row level security;
alter table airlines enable row level security;
create policy public_read on airports for select using (true);
create policy public_read on airlines for select using (true);
