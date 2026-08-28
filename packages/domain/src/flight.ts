// Domain vocabulary: see /CONTEXT.md. Shapes mirror docs/schema.sql.

export type FlightStatus = "flown" | "upcoming" | "cancelled" | "not_a_flight";

export type EmailType =
  | "confirmation"
  | "receipt"
  | "check_in"
  | "cancellation"
  | "marketing"
  | "unknown";

export type ExtractionTier = "schema_org" | "kitinerary" | "llm";

export interface Flight {
  id: string;
  userId: string;
  status: FlightStatus;
  airlineIata: string | null;
  flightNumber: string | null;
  originIata: string;
  destIata: string;
  departureDate: string; // ISO date
  // Local wall times are source truth; UTC is derived. Absence is information.
  depLocal: string | null;
  depTz: string | null;
  depUtc: string | null;
  arrLocal: string | null;
  arrTz: string | null;
  arrUtc: string | null;
  distanceKm: number | null;
  bookingRef: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  confidence: number;
  extractionVersion: number;
  tripId: string | null;
  needsReview: boolean;
  reviewReason: string | null;
}

/** Confidence is deterministic: tier base + validation modifiers, never
 *  model-self-reported. Versioned with EXTRACTION_VERSION. */
export const CONFIDENCE_BASE: Record<ExtractionTier, number> = {
  schema_org: 0.95,
  kitinerary: 0.9,
  llm: 0.75,
};

/** Bump when extraction rules change; requires an eval report on the PR. */
export const EXTRACTION_VERSION = 1;

/** Trip clustering: max gap between chained flights (days). */
export const TRIP_CHAIN_MAX_GAP_DAYS = 21;
