import { describe, expect, it } from "vitest";
import { haversineKm } from "./distance.js";

// Reference coordinates: VNO 54.6341,25.2858 · FRA 50.0264,8.5431 · NRT 35.7647,140.386
describe("haversineKm", () => {
  it("is zero for identical points", () => {
    expect(haversineKm(54.6341, 25.2858, 54.6341, 25.2858)).toBe(0);
  });

  it("VNO→FRA is ~1,170 km", () => {
    const km = haversineKm(54.6341, 25.2858, 50.0264, 8.5431);
    expect(km).toBeGreaterThan(1100);
    expect(km).toBeLessThan(1250);
  });

  it("FRA→NRT is ~9,350 km (the wireframes' 9,355)", () => {
    const km = haversineKm(50.0264, 8.5431, 35.7647, 140.386);
    expect(km).toBeGreaterThan(9250);
    expect(km).toBeLessThan(9450);
  });

  it("is symmetric", () => {
    expect(haversineKm(54.6341, 25.2858, 35.7647, 140.386)).toBe(
      haversineKm(35.7647, 140.386, 54.6341, 25.2858),
    );
  });
});
