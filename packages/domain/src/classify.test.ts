import { describe, expect, it } from "vitest";
import { isLikelyFlightEmail } from "./classify.js";

const email = (subject: string, from: string, body = "") => ({ subject, from, body });

describe("isLikelyFlightEmail", () => {
  it("accepts a confirmation naming a flight number", () => {
    expect(
      isLikelyFlightEmail(email("Your booking confirmation", "noreply@wizzair.com", "W6 1912 departs 09:15")),
    ).toBe(true);
  });

  it("accepts an itinerary naming a route", () => {
    expect(
      isLikelyFlightEmail(email("Your itinerary", "info@edreams.com", "VNO → BCN on 3 May")),
    ).toBe(true);
  });

  it("rejects airline marketing with no flight evidence", () => {
    // The expensive case: airline branding without a flight in sight. These
    // were most of the wasted calls in the first live import.
    expect(
      isLikelyFlightEmail(email("Deals from €19! Book now", "news@wizzair.com", "Sale ends Sunday. Unsubscribe")),
    ).toBe(false);
  });

  it("rejects a flight-shaped token with no booking language at all", () => {
    expect(isLikelyFlightEmail(email("Meeting notes", "colleague@example.com", "Room A4 12 at noon"))).toBe(false);
  });

  it("still accepts booking-agent mail", () => {
    expect(
      isLikelyFlightEmail(email("E-ticket", "no-reply@kiwi.com", "FR 1830 · VNO-TSF")),
    ).toBe(true);
  });
});
