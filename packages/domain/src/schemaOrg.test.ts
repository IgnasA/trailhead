import { describe, expect, it } from "vitest";
import { extractSchemaOrgFlights } from "./schemaOrg.js";

const SAMPLE = `<html><head><script type="application/ld+json">
{"@context":"https://schema.org","@type":"FlightReservation",
 "reservationNumber":"7QK4RB",
 "reservationFor":{"@type":"Flight","flightNumber":"710",
   "airline":{"@type":"Airline","iataCode":"LH","name":"Lufthansa"},
   "departureAirport":{"@type":"Airport","iataCode":"FRA"},
   "arrivalAirport":{"@type":"Airport","iataCode":"NRT"},
   "departureTime":"2025-06-14T17:05:00+02:00",
   "arrivalTime":"2025-06-15T11:40:00+09:00"}}
</script></head><body>booking</body></html>`;

describe("extractSchemaOrgFlights", () => {
  it("extracts a FlightReservation with local wall times preserved", () => {
    const [f] = extractSchemaOrgFlights(SAMPLE);
    expect(f).toMatchObject({
      isFlightEmail: true,
      airlineIata: "LH",
      flightNumber: "710",
      originIata: "FRA",
      destIata: "NRT",
      departureDate: "2025-06-14",
      depLocalTime: "17:05", // verbatim local time, never converted
      arrLocalTime: "11:40",
      bookingRef: "7QK4RB",
    });
  });

  it("handles arrays of reservations and @graph wrappers", () => {
    const doubled = SAMPLE.replace(
      '{"@context"',
      '[{"@context":"https://schema.org","@graph":[{"@type":"FlightReservation","reservationFor":{"@type":"Flight","departureAirport":{"@type":"Airport","iataCode":"VNO"},"arrivalAirport":{"@type":"Airport","iataCode":"BCN"},"departureTime":"2025-05-03"}}]},{"@context"',
    ).replace("</script>", "]</script>");
    const flights = extractSchemaOrgFlights(doubled);
    expect(flights).toHaveLength(2);
    expect(flights[0]).toMatchObject({ originIata: "VNO", destIata: "BCN", depLocalTime: null });
  });

  it("returns empty on marketing mail without markup", () => {
    expect(extractSchemaOrgFlights("<html><body>SALE! Fly cheap!</body></html>")).toHaveLength(0);
  });

  it("ignores malformed JSON-LD blocks", () => {
    expect(
      extractSchemaOrgFlights('<script type="application/ld+json">{oops</script>'),
    ).toHaveLength(0);
  });
});
