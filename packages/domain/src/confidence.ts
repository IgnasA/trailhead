// Deterministic confidence (pipeline ticket): tier base + validation
// modifiers. Never model-self-reported. Versioned with EXTRACTION_VERSION.
import { CONFIDENCE_BASE, type ExtractionTier } from "./flight.js";
import type { FlightExtraction } from "./extraction.js";
import { normalizeFlightNumber } from "./flightNumber.js";

export interface ValidationContext {
  originKnown: boolean; // IATA resolves in reference data
  destKnown: boolean;
  corroboratingEmails: number; // beyond the first
}

export function computeConfidence(
  tier: ExtractionTier,
  extraction: FlightExtraction,
  ctx: ValidationContext,
): number {
  let c = CONFIDENCE_BASE[tier];
  if (!ctx.originKnown || !ctx.destKnown) c -= 0.3;
  if (!extraction.depLocalTime) c -= 0.1;
  if (!extraction.flightNumber) c -= 0.05;
  c += Math.min(ctx.corroboratingEmails, 2) * 0.02;
  return Math.min(0.99, Math.max(0.05, Math.round(c * 100) / 100));
}

/** Merge key (pipeline ticket): flights from different emails describing the
 *  same flown segment collapse onto one canonical flight. */
export function mergeKey(e: FlightExtraction): string {
  return [
    e.airlineIata ?? "??",
    normalizeFlightNumber(e.flightNumber, e.airlineIata) ?? "",
    e.departureDate ?? "????",
    e.originIata ?? "???",
    e.destIata ?? "???",
  ].join("|");
}
