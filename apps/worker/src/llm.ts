// Tier 3: Claude Haiku for emails the deterministic tiers couldn't parse.
// Model choice is a resolved map decision (extraction + pipeline tickets):
// synchronous Haiku during interactive imports. Strict tool schema; output
// re-validated with Zod — never trusted raw.
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

const SEGMENT_PROPS = {
  airlineIata: { type: ["string", "null"], description: "2-char IATA airline code" },
  airlineName: { type: ["string", "null"] },
  flightNumber: { type: ["string", "null"], description: "digits only if possible, e.g. 710" },
  originIata: { type: ["string", "null"], description: "3-letter IATA airport code" },
  destIata: { type: ["string", "null"] },
  departureDate: { type: ["string", "null"], description: "YYYY-MM-DD as stated" },
  depLocalTime: { type: ["string", "null"], description: "HH:MM local wall time, verbatim" },
  arrLocalTime: { type: ["string", "null"] },
  bookingRef: { type: ["string", "null"] },
  priceAmount: { type: ["number", "null"] },
  priceCurrency: { type: ["string", "null"], description: "3-letter currency code" },
} as const;

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: "record_flight_extraction",
  description:
    "Record whether this email contains flight information and every flight segment it describes.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["isFlightEmail", "emailType", "flights"],
    properties: {
      isFlightEmail: { type: "boolean" },
      emailType: {
        type: "string",
        enum: ["confirmation", "receipt", "check_in", "cancellation", "marketing", "unknown"],
      },
      flights: {
        type: "array",
        description:
          "One entry per flight segment. A return trip has two; a trip with a connection has one per leg.",
        items: {
          type: "object",
          additionalProperties: false,
          required: Object.keys(SEGMENT_PROPS),
          properties: SEGMENT_PROPS,
        },
      },
    },
  },
};

const SYSTEM = `You extract flight data from a single email for a personal travel-history product.

Rules (non-negotiable):
- Never invent missing information — use null for any field the email does not state.
- Never guess airport codes, dates, or prices. Preserve source values verbatim; local times exactly as written.
- Extract EVERY flight segment the email describes, one entry per segment. A return booking has two segments (outbound and return); a journey with a connection has one segment per leg. Missing the return leg is a serious error.
- Marketing, newsletters, price alerts, and non-flight mail are isFlightEmail=false with an empty flights array.`;

interface LlmResult {
  extractions: FlightExtraction[];
  inputTokens: number;
  outputTokens: number;
}

export async function llmExtract(
  subject: string,
  from: string,
  body: string,
): Promise<LlmResult | null> {
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
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

  const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) return null;

  const raw = toolUse.input as {
    isFlightEmail?: boolean;
    emailType?: string;
    flights?: unknown[];
  };
  if (!raw.isFlightEmail) return { extractions: [], ...usage };

  const extractions: FlightExtraction[] = [];
  for (const segment of raw.flights ?? []) {
    const parsed = FlightExtractionSchema.safeParse({
      ...(segment as object),
      isFlightEmail: true,
      emailType: raw.emailType ?? "unknown",
    });
    if (parsed.success) extractions.push(parsed.data);
  }
  return { extractions, ...usage };
}
