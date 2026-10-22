import { describe, expect, it } from "vitest";
import { isUuid, parseManualFlight, readJson, MAX_BODY_BYTES } from "./manualFlight";

const base = { origin: "vno", dest: "FRA", date: "2024-03-09" };

describe("parseManualFlight", () => {
  it("accepts the form as the browser sends it", () => {
    const r = parseManualFlight({
      ...base, airline: "lh", flightNumber: "LH 883", depTime: "07:45", arrTime: "",
      bookingRef: "ABC123",
    });
    expect(r).toEqual({
      ok: true,
      value: {
        origin: "VNO", dest: "FRA", date: "2024-03-09", airline: "lh", flightNumber: "LH 883",
        depTime: "07:45", arrTime: null, bookingRef: "ABC123", price: null, currency: null,
      },
    });
  });

  it("accepts times as Postgres returns them when editing", () => {
    expect(parseManualFlight({ ...base, depTime: "07:45:00", arrTime: "09:10:00" }).ok).toBe(true);
  });

  it("rejects a missing or impossible date (PATCH used to skip this)", () => {
    expect(parseManualFlight({ ...base, date: undefined }).ok).toBe(false);
    expect(parseManualFlight({ ...base, date: "2024-02-30" }).ok).toBe(false);
    expect(parseManualFlight({ ...base, date: "2024-3-9" }).ok).toBe(false);
  });

  it("rejects bad airports and a round trip to nowhere", () => {
    expect(parseManualFlight({ ...base, origin: "VN" }).ok).toBe(false);
    expect(parseManualFlight({ ...base, dest: "VNO" }).ok).toBe(false);
    expect(parseManualFlight({ ...base, origin: 42 }).ok).toBe(false);
  });

  it("bounds free text so one request can't store megabytes", () => {
    expect(parseManualFlight({ ...base, bookingRef: "x".repeat(33) }).ok).toBe(false);
    expect(parseManualFlight({ ...base, flightNumber: "9".repeat(17) }).ok).toBe(false);
    expect(parseManualFlight({ ...base, airline: "LUFT" }).ok).toBe(false);
  });

  it("rejects non-string text and malformed times", () => {
    expect(parseManualFlight({ ...base, bookingRef: { $ne: 1 } }).ok).toBe(false);
    expect(parseManualFlight({ ...base, depTime: "25:00" }).ok).toBe(false);
    expect(parseManualFlight({ ...base, arrTime: "7pm" }).ok).toBe(false);
  });

  it("checks price and currency", () => {
    expect(parseManualFlight({ ...base, price: 129.5, currency: "eur" }).ok).toBe(true);
    expect(parseManualFlight({ ...base, price: -1 }).ok).toBe(false);
    expect(parseManualFlight({ ...base, price: "12" }).ok).toBe(false);
    expect(parseManualFlight({ ...base, price: 1e12 }).ok).toBe(false);
    expect(parseManualFlight({ ...base, currency: "EURO" }).ok).toBe(false);
  });

  it("rejects a body that isn't an object", () => {
    expect(parseManualFlight(null).ok).toBe(false);
    expect(parseManualFlight("VNO-FRA").ok).toBe(false);
  });
});

describe("isUuid", () => {
  it("only accepts uuids", () => {
    expect(isUuid("6f1c2a52-0b5e-4c47-9d33-0b8f2f0a8a11")).toBe(true);
    expect(isUuid("6f1c2a52")).toBe(false);
    expect(isUuid(7)).toBe(false);
  });
});

describe("readJson", () => {
  const post = (body: string) => new Request("http://x/api", { method: "POST", body });

  it("parses JSON", async () => {
    expect(await readJson(post('{"id":"a"}'))).toEqual({ id: "a" });
  });

  it("returns undefined for malformed JSON instead of throwing", async () => {
    expect(await readJson(post("{nope"))).toBeUndefined();
  });

  it("refuses oversized bodies", async () => {
    expect(await readJson(post(JSON.stringify({ x: "a".repeat(MAX_BODY_BYTES) })))).toBeUndefined();
  });
});
