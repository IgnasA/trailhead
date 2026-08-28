// Tier 3: Claude Haiku for emails the deterministic tiers couldn't parse.
// Model choice is a resolved map decision (extraction + pipeline tickets):
// synchronous Haiku during interactive imports. Strict tool schema mirrors
// FlightExtractionSchema; output re-validated with Zod — never trusted raw.
import Anthropic from "@anthropic-ai/sdk";
import { FlightExtractionSchema, type FlightExtraction } from "@trailhead/domain";

const client = new Anthropic();

/** The LLM tier being *entirely* unavailable (no credit, bad key) is not a
 *  per-email failure — it's a systemic one. The pipeline trips a breaker on
 *  this rather than grinding a whole mailbox into identical errors. */
export class LlmUnavailableError extends Error {
  constructor(
    readonly code: "no_credit" | "auth" | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: "record_flight_extraction",
  description:
    "Record whether this email contains flight information and the extracted fields.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "isFlightEmail", "emailType", "airlineIata", "airlineName", "flightNumber",
      "originIata", "destIata", "departureDate", "depLocalTime", "arrLocalTime",
      "bookingRef", "priceAmount", "priceCurrency",
    ],
    properties: {
      isFlightEmail: { type: "boolean" },
      emailType: {
        type: "string",
        enum: ["confirmation", "receipt", "check_in", "cancellation", "marketing", "unknown"],
      },
      airlineIata: { type: ["string", "null"], description: "2-char IATA airline code" },
      airlineName: { type: ["string", "null"] },
      flightNumber: { type: ["string", "null"] },
      originIata: { type: ["string", "null"], description: "3-letter IATA airport code" },
      destIata: { type: ["string", "null"] },
      departureDate: { type: ["string", "null"], description: "YYYY-MM-DD as stated" },
      depLocalTime: { type: ["string", "null"], description: "HH:MM local wall time, verbatim" },
      arrLocalTime: { type: ["string", "null"] },
      bookingRef: { type: ["string", "null"] },
      priceAmount: { type: ["number", "null"] },
      priceCurrency: { type: ["string", "null"], description: "3-letter currency code" },
    },
  },
};

const SYSTEM = `You extract flight data from a single email for a personal travel-history product.
Rules (non-negotiable): never invent missing information — use null when a field is not stated in the email; never guess airport codes, dates, or prices; preserve source values verbatim (local wall times exactly as written); one call per flight segment actually described; marketing or non-flight mail is isFlightEmail=false. If the email describes several segments, extract only the FIRST segment in this call.`;

export async function llmExtract(
  subject: string,
  from: string,
  body: string,
): Promise<FlightExtraction | null> {
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: "record_flight_extraction" },
      messages: [
        {
          role: "user",
          content: `From: ${from}\nSubject: ${subject}\n\n${body.slice(0, 30000)}`,
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new LlmUnavailableError("auth", "Anthropic API key rejected");
    }
    if (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)) {
      throw new LlmUnavailableError("no_credit", "Anthropic account has no credit");
    }
    throw err; // transient/per-email — the caller records one failure
  }
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) return null;
  const parsed = FlightExtractionSchema.safeParse(toolUse.input);
  return parsed.success ? parsed.data : null;
}
