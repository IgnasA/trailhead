import { z } from "zod";

/** The extraction contract (brief §12, evolved): the LLM/parsers must never
 *  invent values — null means "not found in source". The model's own
 *  confidence is NOT part of this schema; confidence is computed
 *  deterministically (see CONFIDENCE_BASE). */
export const FlightExtractionSchema = z
  .object({
    isFlightEmail: z.boolean(),
    emailType: z.enum([
      "confirmation",
      "receipt",
      "check_in",
      "cancellation",
      "marketing",
      "unknown",
    ]),
    airlineIata: z.string().length(2).nullable(),
    airlineName: z.string().nullable(),
    flightNumber: z.string().nullable(),
    originIata: z.string().length(3).nullable(),
    destIata: z.string().length(3).nullable(),
    departureDate: z.string().nullable(), // YYYY-MM-DD as stated in the email
    depLocalTime: z.string().nullable(), // HH:MM local wall time, verbatim
    arrLocalTime: z.string().nullable(),
    bookingRef: z.string().nullable(),
    priceAmount: z.number().nullable(),
    priceCurrency: z.string().length(3).nullable(),
  })
  .strict();

export type FlightExtraction = z.infer<typeof FlightExtractionSchema>;
