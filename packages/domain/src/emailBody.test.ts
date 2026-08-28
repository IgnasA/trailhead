import { describe, expect, it } from "vitest";
import { bodyForExtraction, htmlToText, tidyText } from "./emailBody.js";

describe("htmlToText", () => {
  it("drops script/style and keeps the values", () => {
    const html = `<html><style>.x{color:red}</style><script>track()</script>
      <body><table><tr><td>LH 710</td><td>FRA</td><td>17:05</td></tr></table></body></html>`;
    const text = htmlToText(html);
    expect(text).toContain("LH 710");
    expect(text).toContain("FRA");
    expect(text).toContain("17:05");
    expect(text).not.toContain("color:red");
    expect(text).not.toContain("track()");
  });

  it("keeps adjacent table cells apart", () => {
    // Without cell boundaries this reads "FRA17:05" and the time is lost.
    expect(htmlToText("<tr><td>FRA</td><td>17:05</td></tr>")).toMatch(/FRA\s+17:05/);
  });

  it("decodes the entities that appear in airline mail", () => {
    expect(htmlToText("<p>Frankfurt&nbsp;&mdash;&nbsp;Tokyo &amp; back</p>")).toBe(
      "Frankfurt — Tokyo & back",
    );
  });

  it("collapses the whitespace HTML leaves behind", () => {
    expect(htmlToText("<div>a</div>\n\n\n<div>b</div>")).toBe("a\n\nb");
  });
});

describe("tidyText", () => {
  it("collapses the CRLF padding airlines put in plain-text parts", () => {
    // A real Wizz Air itinerary arrived with ~2,300 chars of \r\n padding.
    const padded = "Wizz Air" + "\r\n".repeat(40) + "flights\r\nhotel";
    expect(tidyText(padded)).toBe("Wizz Air\n\nflights\nhotel");
  });
});

describe("bodyForExtraction", () => {
  it("tidies the plain-text part it chooses", () => {
    expect(bodyForExtraction("A" + "\r\n".repeat(30) + "B".repeat(300), "")).toBe(
      "A\n\n" + "B".repeat(300),
    );
  });

  it("prefers a real plain-text part", () => {
    const text = "Booking confirmed. ".repeat(20);
    expect(bodyForExtraction(text, "<p>html version</p>")).toContain("Booking confirmed");
  });

  it("falls back to flattened HTML when text is empty or a stub", () => {
    expect(bodyForExtraction("  ", "<p>LH710 FRA NRT</p>")).toBe("LH710 FRA NRT");
    expect(bodyForExtraction("View in browser", "<p>LH710 FRA NRT</p>")).toBe("LH710 FRA NRT");
  });

  it("caps enormous emails", () => {
    expect(bodyForExtraction("x".repeat(50000), "")).toHaveLength(6000);
  });
});
