import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./sameOrigin";

const req = (headers: Record<string, string>) =>
  new Request("http://localhost:3000/api/rebuild", { method: "POST", headers });

describe("isSameOrigin", () => {
  it("accepts a request from this origin", () => {
    expect(isSameOrigin(req({ host: "localhost:3000", origin: "http://localhost:3000" }))).toBe(true);
  });

  it("uses the forwarded host behind a proxy", () => {
    expect(isSameOrigin(req({
      host: "10.0.0.4:3000", "x-forwarded-host": "trailhead.app", origin: "https://trailhead.app",
    }))).toBe(true);
  });

  it("rejects another site", () => {
    expect(isSameOrigin(req({ host: "trailhead.app", origin: "https://evil.example" }))).toBe(false);
  });

  it("rejects a look-alike host on a different port", () => {
    expect(isSameOrigin(req({ host: "trailhead.app", origin: "https://trailhead.app:8443" }))).toBe(false);
  });

  it("rejects the opaque null origin", () => {
    expect(isSameOrigin(req({ host: "trailhead.app", origin: "null" }))).toBe(false);
  });

  it("rejects a malformed origin", () => {
    expect(isSameOrigin(req({ host: "trailhead.app", origin: "not a url" }))).toBe(false);
  });

  it("falls back to Sec-Fetch-Site when Origin is absent", () => {
    expect(isSameOrigin(req({ host: "trailhead.app", "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(req({ host: "trailhead.app", "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("lets a non-browser client through (it carries no session cookie to abuse)", () => {
    expect(isSameOrigin(req({ host: "trailhead.app" }))).toBe(true);
  });
});
