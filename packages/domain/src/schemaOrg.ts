// Tier 1: schema.org FlightReservation JSON-LD embedded in airline email HTML.
// Deterministic — when present it maps 1:1 to the extraction contract.
import type { FlightExtraction } from "./extraction.js";

type JsonValue = unknown;

function collectNodes(value: JsonValue, out: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    for (const v of value) collectNodes(v, out);
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj["@type"] === "FlightReservation") out.push(obj);
    if (obj["@graph"]) collectNodes(obj["@graph"], out);
  }
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

function iata(v: unknown): string | null {
  const s = str(v)?.toUpperCase() ?? null;
  return s && /^[A-Z]{3}$/.test(s) ? s : null;
}

/** "2025-06-14T17:05:00+02:00" → { date: "2025-06-14", time: "17:05" }.
 *  The stated local wall time is source truth — never converted here. */
function splitLocal(v: unknown): { date: string | null; time: string | null } {
  const s = str(v);
  if (!s) return { date: null, time: null };
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
  return m ? { date: m[1] ?? null, time: m[2] ?? null } : { date: null, time: null };
}

/** Extract FlightReservation nodes from raw HTML. Returns one extraction per
 *  reservation node with a plausible flight; empty array = tier miss. */
export function extractSchemaOrgFlights(html: string): FlightExtraction[] {
  const out: FlightExtraction[] = [];
  const scripts = html.matchAll(
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  const nodes: Record<string, unknown>[] = [];
  for (const m of scripts) {
    try {
      collectNodes(JSON.parse(m[1] ?? ""), nodes);
    } catch {
      // malformed block — not our problem at this tier
    }
  }
  for (const node of nodes) {
    const flight = (node["reservationFor"] ?? {}) as Record<string, unknown>;
    if (flight["@type"] !== "Flight") continue;
    const airline = (flight["airline"] ?? {}) as Record<string, unknown>;
    const dep = (flight["departureAirport"] ?? {}) as Record<string, unknown>;
    const arr = (flight["arrivalAirport"] ?? {}) as Record<string, unknown>;
    const depParts = splitLocal(flight["departureTime"]);
    const arrParts = splitLocal(flight["arrivalTime"]);
    const originIata = iata(dep["iataCode"]);
    const destIata = iata(arr["iataCode"]);
    if (!originIata || !destIata || !depParts.date) continue;
    out.push({
      isFlightEmail: true,
      emailType: "confirmation",
      airlineIata: str(airline["iataCode"])?.toUpperCase().slice(0, 2) ?? null,
      airlineName: str(airline["name"]),
      flightNumber: str(flight["flightNumber"]),
      originIata,
      destIata,
      departureDate: depParts.date,
      depLocalTime: depParts.time,
      arrLocalTime: arrParts.time,
      bookingRef: str(node["reservationNumber"]),
      priceAmount: null,
      priceCurrency: null,
    });
  }
  return out;
}
