-- Local wall time is the source truth, but UTC is what orders flights and
-- measures durations; it was never derived, so every duration fell back to a
-- distance estimate. Derive it from the stored local time and the airport's
-- IANA zone, rolling an arrival that lands "before" departure to the next day.
update flights set dep_utc = (dep_local at time zone dep_tz)
where dep_local is not null and dep_tz is not null and dep_utc is null;

update flights set arr_utc = (arr_local at time zone arr_tz)
where arr_local is not null and arr_tz is not null and arr_utc is null;

update flights set arr_utc = arr_utc + interval '1 day'
where arr_utc is not null and dep_utc is not null and arr_utc <= dep_utc;
