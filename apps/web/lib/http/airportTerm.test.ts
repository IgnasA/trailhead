import { describe, expect, it } from "vitest";
import { airportSearchTerm } from "./airportTerm";

describe("airportSearchTerm", () => {
  it("keeps codes, cities and names", () => {
    expect(airportSearchTerm(" vno ")).toBe("vno");
    expect(airportSearchTerm("Zürich")).toBe("Zürich");
    expect(airportSearchTerm("Charles de Gaulle")).toBe("Charles de Gaulle");
    expect(airportSearchTerm("Wilkes-Barre")).toBe("Wilkes-Barre");
    expect(airportSearchTerm("O'Hare")).toBe("O'Hare");
    expect(airportSearchTerm("東京")).toBe("東京");
  });

  it("drops PostgREST filter syntax so the or() string can't be extended", () => {
    expect(airportSearchTerm("x%,iata.not.is.null")).toBe("xiatanotisnull");
    expect(airportSearchTerm('a"),name.eq.(b')).toBe("anameeqb");
    expect(airportSearchTerm("lon*don\\")).toBe("london");
    expect(airportSearchTerm("a_b:c")).toBe("abc");
  });

  it("caps the length", () => {
    expect(airportSearchTerm("a".repeat(500))).toHaveLength(64);
  });

  it("returns empty for punctuation-only input", () => {
    expect(airportSearchTerm("%%,,()")).toBe("");
  });
});
