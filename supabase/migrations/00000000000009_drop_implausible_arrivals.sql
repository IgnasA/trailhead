-- Arrivals were extracted as a time with no date, so a midnight crossing has
-- to be inferred. Where that inference produces a duration the great-circle
-- distance says is impossible (a 23-hour hop to Stockholm — caused by a
-- wrong-but-real airport code putting the origin in Morocco), we do not know
-- the arrival, so record that we don't rather than keep a fabricated
-- interval. The reveal falls back to a stated estimate.
update flights set arr_utc = null
where arr_utc is not null and dep_utc is not null and distance_km is not null
  and extract(epoch from (arr_utc - dep_utc)) / 3600.0
      > 2.0 * (distance_km / 800.0 + 0.5);
