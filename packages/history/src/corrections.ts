// Replaying Corrections over a rebuild. A Correction is an immutable event —
// "this wasn't a flight", "that was Vilnius, not Dakhla" — and the rebuild
// deletes every Flight before re-deriving them, so a correction that only
// edited a Flight row was undone by the next import. Replay makes the
// correction an input instead: it is applied to the merged groups, in the
// order it was made, before anything is written.
//
// Kept free of SQL so the rules can be tested without a database.
import { mergeKey, type FlightExtraction } from "@trailhead/domain";

/** One merged segment on its way to becoming a Flight. `manual` is set when a
 *  typed flight contributed, whether or not emails did too. */
export interface Group {
  ids: string[];
  tiers: string[];
  ex: FlightExtraction;
  manual: boolean;
  /** Marked "not a flight" by the person. Still written — the label is the
   *  eval example — but with that status, so it counts nowhere. */
  notAFlight?: boolean;
  /** Touched by at least one replayed correction. */
  corrected?: boolean;
}

/** Which flight a correction was about, as the person saw it when they made
 *  it. Flight ids don't survive a rebuild, so this is the merge identity —
 *  the same five fields the merge key is built from, snake_cased as the
 *  flights row spells them. */
export interface FlightIdentity {
  airline_iata: string | null;
  flight_number: string | null;
  departure_date: string;
  origin_iata: string;
  dest_iata: string;
}

export interface StoredCorrection {
  id: string;
  kind: string;
  payload: Record<string, unknown> & { target?: FlightIdentity };
}

export interface ReplayResult {
  applied: number;
  /** Corrections whose flight no longer exists in the inputs — its emails
   *  were deleted, or it was never found again. Kept, not discarded: the
   *  emails may come back on a later import. */
  unmatched: number;
}

/** The correctable fields, mapped from the payload's spelling to the
 *  extraction's. Anything else in a payload is ignored rather than guessed. */
const FIELDS = {
  origin_iata: "originIata",
  dest_iata: "destIata",
  departure_date: "departureDate",
  airline_iata: "airlineIata",
  flight_number: "flightNumber",
} as const satisfies Record<string, keyof FlightExtraction>;

const IATA_AIRPORT = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function identityKey(t: FlightIdentity): string {
  return mergeKey({
    airlineIata: t.airline_iata,
    flightNumber: t.flight_number,
    departureDate: t.departure_date,
    originIata: t.origin_iata,
    destIata: t.dest_iata,
  } as FlightExtraction);
}

/** The identity of a flight row or an extraction payload — whichever shape. */
export function identityOf(row: Record<string, unknown>): FlightIdentity | null {
  const pick = (snake: string, camel: string) =>
    (row[snake] ?? row[camel] ?? null) as string | null;
  const identity = {
    airline_iata: pick("airline_iata", "airlineIata"),
    flight_number: pick("flight_number", "flightNumber"),
    departure_date: pick("departure_date", "departureDate"),
    origin_iata: pick("origin_iata", "originIata"),
    dest_iata: pick("dest_iata", "destIata"),
  };
  if (!identity.departure_date || !identity.origin_iata || !identity.dest_iata) return null;
  return identity as FlightIdentity;
}

/**
 * Apply corrections, oldest first, to the merged groups — in place. Each one
 * finds its flight by the identity it had when the person corrected it, which
 * is the identity after every earlier correction: correcting a flight twice
 * chains. Last write wins.
 *
 * A field fix re-keys the group. If that lands it on a flight that already
 * exists — the corrected airport is the one another email had right — the two
 * are the same flight and merge, the corrected values winning.
 */
export function replayCorrections(
  groups: Map<string, Group>,
  corrections: StoredCorrection[],
): ReplayResult {
  let applied = 0;
  let unmatched = 0;

  for (const c of corrections) {
    const target = c.payload.target;
    const key = target ? identityKey(target) : null;
    const group = key ? groups.get(key) : undefined;
    if (!key || !group) {
      unmatched += 1;
      continue;
    }

    if (c.kind === "not_a_flight") {
      group.notAFlight = true;
      group.corrected = true;
      applied += 1;
      continue;
    }

    if (c.kind === "correct_field") {
      const ex = { ...group.ex };
      for (const [field, prop] of Object.entries(FIELDS)) {
        const value = c.payload[field];
        if (typeof value !== "string" || value.trim() === "") continue;
        const v = value.trim().toUpperCase();
        if ((prop === "originIata" || prop === "destIata") && !IATA_AIRPORT.test(v)) continue;
        if (prop === "departureDate" && !DATE.test(value.trim())) continue;
        (ex as Record<string, unknown>)[prop] = prop === "departureDate" ? value.trim() : v;
      }
      group.ex = ex;
      group.corrected = true;
      const next = mergeKey(ex);
      if (next !== key) {
        groups.delete(key);
        const existing = groups.get(next);
        if (existing) {
          for (const k of Object.keys(existing.ex) as (keyof FlightExtraction)[]) {
            if (group.ex[k] == null && existing.ex[k] != null) {
              (group.ex as Record<string, unknown>)[k] = existing.ex[k];
            }
          }
          group.ids.push(...existing.ids);
          group.tiers.push(...existing.tiers);
          group.manual ||= existing.manual;
          group.notAFlight ||= existing.notAFlight;
        }
        groups.set(next, group);
      }
      applied += 1;
      continue;
    }

    // assign_trip is in the schema but nothing records one yet, and pinning
    // trips is its own piece of work. Counted as unmatched so it isn't silent.
    unmatched += 1;
  }

  return { applied, unmatched };
}
