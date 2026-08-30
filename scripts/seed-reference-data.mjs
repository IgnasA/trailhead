// Loads the vendored reference data (scripts/vendor-reference-data.mjs output)
// into the airports/airlines tables. Idempotent upsert.
// Run: node --env-file=.env.local scripts/seed-reference-data.mjs
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const DATA = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "packages/domain/data",
);
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set (use node --env-file=.env.local)");

const airports = JSON.parse(await readFile(path.join(DATA, "airports.json"), "utf8"));
const airlines = JSON.parse(await readFile(path.join(DATA, "airlines.json"), "utf8"));

const client = new pg.Client({ connectionString: url });
await client.connect();

// airports: single upsert via unnest arrays (fast, one round trip)
const a = Object.entries(airports).filter(([, v]) => v.tz); // schema requires tz
await client.query(
  `insert into airports (iata, name, municipality, iso_country, lat, lon, tz, type)
   select * from unnest($1::text[], $2::text[], $3::text[], $4::text[],
                        $5::float8[], $6::float8[], $7::text[], $8::text[])
   on conflict (iata) do update set
     name = excluded.name, municipality = excluded.municipality,
     iso_country = excluded.iso_country, lat = excluded.lat,
     lon = excluded.lon, tz = excluded.tz, type = excluded.type`,
  [
    a.map(([k]) => k),
    a.map(([, v]) => v.name),
    a.map(([, v]) => v.city),
    a.map(([, v]) => v.country),
    a.map(([, v]) => v.lat),
    a.map(([, v]) => v.lon),
    a.map(([, v]) => v.tz),
    a.map(([, v]) => v.type ?? null),
  ],
);
console.log(`airports: upserted ${a.length} (${Object.keys(airports).length - a.length} skipped without tz)`);

// airlines: replace the seed rows wholesale (overlay already merged in the JSON)
const l = Object.entries(airlines);
await client.query("delete from airlines where source = 'openflights-seed'");
await client.query(
  `insert into airlines (iata, icao, name, source)
   select *, 'openflights-seed' from unnest($1::text[], $2::text[], $3::text[])`,
  [l.map(([k]) => k), l.map(([, v]) => v.icao), l.map(([, v]) => v.name)],
);
console.log(`airlines: seeded ${l.length}`);

await client.end();
