// Vendors reference data into packages/domain/data/ (reference-data ticket):
//  - airports.json  from OurAirports (public domain), IATA-coded rows only,
//    with IANA tz computed here, once, via @photostructure/tz-lookup
//  - airlines.json  from OpenFlights airlines.dat (ODbL — seed only) merged
//    with our own overlay file, airline-overlay.json
// Run: pnpm vendor:reference-data   (needs network)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import tzlookup from "@photostructure/tz-lookup";

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "packages/domain/data",
);
const AIRPORTS_URL =
  "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv";
const AIRLINES_URL =
  "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat";

// Minimal CSV parser handling quoted fields (both sources use them).
function parseCsvLine(line) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const fetchText = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
};

await mkdir(OUT, { recursive: true });

// ── airports ────────────────────────────────────────────────────────────────
const csv = (await fetchText(AIRPORTS_URL)).split("\n");
const header = parseCsvLine(csv[0]);
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const airports = {};
for (const line of csv.slice(1)) {
  if (!line.trim()) continue;
  const f = parseCsvLine(line);
  const iata = f[col.iata_code];
  const type = f[col.type];
  if (!iata || !/^[A-Z]{3}$/.test(iata)) continue;
  if (type === "closed") continue;
  const lat = Number(f[col.latitude_deg]);
  const lon = Number(f[col.longitude_deg]);
  let tz = null;
  try { tz = tzlookup(lat, lon); } catch { /* polar/invalid coords */ }
  airports[iata] = {
    name: f[col.name],
    city: f[col.municipality] || null,
    country: f[col.iso_country], // ISO 3166-1 alpha-2 + unofficial (XK)
    lat, lon, tz,
  };
}
await writeFile(path.join(OUT, "airports.json"), JSON.stringify(airports));
console.log(`airports.json: ${Object.keys(airports).length} IATA airports`);

// ── airlines ────────────────────────────────────────────────────────────────
const overlayPath = path.join(OUT, "airline-overlay.json");
const overlay = JSON.parse(await readFile(overlayPath, "utf8").catch(() => "{}"));
const airlines = {};
for (const line of (await fetchText(AIRLINES_URL)).split("\n")) {
  if (!line.trim()) continue;
  const f = parseCsvLine(line);
  // airlines.dat: id,name,alias,iata,icao,callsign,country,active
  const [, name, , iata, icao, , , active] = f;
  if (!iata || iata === "\\N" || iata === "-" || active !== "Y") continue;
  airlines[iata] = { name, icao: icao === "\\N" ? null : icao };
}
Object.assign(airlines, overlay); // our overlay always wins over the 2017 seed
await writeFile(path.join(OUT, "airlines.json"), JSON.stringify(airlines));
console.log(`airlines.json: ${Object.keys(airlines).length} active airlines (seed + overlay)`);
