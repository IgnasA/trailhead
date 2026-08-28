import { describe, expect, it } from "vitest";
import { normalizeFlightNumber } from "./flightNumber.js";

describe("normalizeFlightNumber", () => {
  it("strips the airline code when we know it", () => {
    // The real duplicate from the first live import: 7Q-1912 vs 1912
    expect(normalizeFlightNumber("7Q-1912", "7Q")).toBe("1912");
    expect(normalizeFlightNumber("1912", "7Q")).toBe("1912");
    expect(normalizeFlightNumber("LH 710", "LH")).toBe("710");
  });

  it("strips a carrier prefix even when the airline is unknown", () => {
    expect(normalizeFlightNumber("LH710", null)).toBe("710");
    expect(normalizeFlightNumber("FR1830", null)).toBe("1830");
  });

  it("normalizes leading zeros and separators", () => {
    expect(normalizeFlightNumber("W6 01912", "W6")).toBe("1912");
    expect(normalizeFlightNumber("0710", null)).toBe("710");
  });

  it("leaves an all-digit number alone and handles absence", () => {
    expect(normalizeFlightNumber("1912", null)).toBe("1912");
    expect(normalizeFlightNumber(null, "LH")).toBeNull();
    expect(normalizeFlightNumber("", "LH")).toBeNull();
  });
});
