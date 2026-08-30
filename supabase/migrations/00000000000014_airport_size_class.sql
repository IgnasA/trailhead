-- Airport size class, from OurAirports' own `type` column. The vendor script
-- always read it (to drop closed airports) and always threw it away, which
-- left the system unable to tell Heathrow from Biggin Hill: searching "London"
-- ranked eight airports alphabetically among equals. Reference data, so it is
-- nullable — an airport with no stated type simply ranks last.
alter table airports add column if not exists type text;

create index if not exists airports_municipality_lower on airports (lower(municipality));
create index if not exists airports_name_lower on airports (lower(name));
