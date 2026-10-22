import { describe, expect, it } from "vitest";
import { mergeKey, type FlightExtraction } from "@trailhead/domain";
import {
  identityKey,
  identityOf,
  replayCorrections,
  type FlightIdentity,
  type Group,
  type StoredCorrection,
} from "./corrections.js";

const ex = (over: Partial<FlightExtraction>): FlightExtraction => ({
  isFlightEmail: true,
  emailType: "confirmation",
  airlineIata: "LH",
  airlineName: null,
  flightNumber: "881",
  originIata: "VIL",
  destIata: "FRA",
  departureDate: "2024-03-01",
  depLocalTime: null,
  arrLocalTime: null,
  bookingRef: null,
  priceAmount: null,
  priceCurrency: null,
  ...over,
});

const groupsOf = (...items: [string, FlightExtraction][]) =>
  new Map<string, Group>(items.map(([id, e]) => [mergeKey(e), { ids: [id], tiers: ["llm"], ex: e, manual: false }]));

const identity = (e: FlightExtraction): FlightIdentity => identityOf(e as unknown as Record<string, unknown>)!;

let seq = 0;
const correction = (kind: string, payload: StoredCorrection["payload"]): StoredCorrection =>
  ({ id: `c${++seq}`, kind, payload });

describe("identityKey", () => {
  it("matches the merge key of the flight it was taken from", () => {
    const e = ex({ flightNumber: "LH 0881" });
    // A flights row stores the normalized number; the key must still agree.
    const row = { airline_iata: "LH", flight_number: "881", departure_date: "2024-03-01", origin_iata: "VIL", dest_iata: "FRA" };
    expect(identityKey(identityOf(row)!)).toBe(mergeKey(e));
  });

  it("reads an extraction payload as well as a flights row", () => {
    expect(identityOf(ex({}) as unknown as Record<string, unknown>)).toEqual({
      airline_iata: "LH", flight_number: "881", departure_date: "2024-03-01", origin_iata: "VIL", dest_iata: "FRA",
    });
  });

  it("has no identity without a route and a date", () => {
    expect(identityOf({ airline_iata: "LH", flight_number: "881", departure_date: "2024-03-01" })).toBeNull();
  });
});

describe("replayCorrections", () => {
  it("re-applies an airport fix to the flight it was made on", () => {
    const wrong = ex({});
    const groups = groupsOf(["e1", wrong]);
    const result = replayCorrections(groups, [
      correction("correct_field", { origin_iata: "VNO", dest_iata: "FRA", target: identity(wrong) }),
    ]);
    expect(result).toEqual({ applied: 1, unmatched: 0 });
    const [g] = [...groups.values()];
    expect(g!.ex.originIata).toBe("VNO");
    expect(g!.corrected).toBe(true);
    // Re-keyed, so a later correction made against the fixed flight finds it.
    expect([...groups.keys()]).toEqual([mergeKey(ex({ originIata: "VNO" }))]);
  });

  it("chains corrections in the order they were made — last write wins", () => {
    const wrong = ex({});
    const groups = groupsOf(["e1", wrong]);
    replayCorrections(groups, [
      correction("correct_field", { origin_iata: "VNO", target: identity(wrong) }),
      correction("correct_field", { origin_iata: "KUN", target: identity(ex({ originIata: "VNO" })) }),
    ]);
    expect([...groups.values()][0]!.ex.originIata).toBe("KUN");
  });

  it("merges a fixed flight into the one another email already had right", () => {
    const wrong = ex({ bookingRef: "ABC123" });
    const right = ex({ originIata: "VNO", depLocalTime: "06:10" });
    const groups = groupsOf(["e1", wrong], ["e2", right]);
    replayCorrections(groups, [
      correction("correct_field", { origin_iata: "VNO", target: identity(wrong) }),
    ]);
    expect(groups.size).toBe(1);
    const [g] = [...groups.values()];
    expect(g!.ids.sort()).toEqual(["e1", "e2"]);
    // Each side fills the other's gaps; nothing is lost in the merge.
    expect(g!.ex.bookingRef).toBe("ABC123");
    expect(g!.ex.depLocalTime).toBe("06:10");
  });

  it("marks a flight as not a flight without dropping it", () => {
    const marketing = ex({ originIata: "VNO", destIata: "LHR", airlineIata: "BA", flightNumber: "123" });
    const groups = groupsOf(["e1", marketing]);
    const result = replayCorrections(groups, [correction("not_a_flight", { target: identity(marketing) })]);
    expect(result.applied).toBe(1);
    expect([...groups.values()][0]!.notAFlight).toBe(true);
  });

  it("keeps but counts corrections whose flight isn't among the inputs", () => {
    const groups = groupsOf(["e1", ex({})]);
    const result = replayCorrections(groups, [
      correction("not_a_flight", { target: identity(ex({ departureDate: "2019-01-01" })) }),
      correction("not_a_flight", {}), // made before replay, never resolved
      correction("assign_trip", { target: identity(ex({})) }),
    ]);
    expect(result).toEqual({ applied: 0, unmatched: 3 });
    expect([...groups.values()][0]!.notAFlight).toBeUndefined();
  });

  it("ignores values that aren't airports or dates rather than writing them", () => {
    const wrong = ex({});
    const groups = groupsOf(["e1", wrong]);
    replayCorrections(groups, [
      correction("correct_field", {
        origin_iata: "Vilnius", dest_iata: " fra ", departure_date: "1 March", seat: "12A",
        target: identity(wrong),
      }),
    ]);
    const [g] = [...groups.values()];
    expect(g!.ex.originIata).toBe("VIL");
    expect(g!.ex.destIata).toBe("FRA");
    expect(g!.ex.departureDate).toBe("2024-03-01");
    expect(g!.ex).not.toHaveProperty("seat");
  });
});
