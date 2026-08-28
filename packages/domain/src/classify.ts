// Deterministic pre-filter: decides which tier-1 misses are worth an LLM
// call. Cheap by design, and the single biggest cost lever — every email it
// rejects is a call not made (brief §28).
//
// Tuned against a 70-email sample of a real mailbox (10 of which contained
// flights):
//   flight-number token  hit 9/10 flight emails, 8/60 non-flight
//   route pattern        hit 2/2 with no false positives
//   booking-ref phrases  hit 45/60 non-flight — useless as a gate
// Requiring one of the first two cuts calls by roughly three quarters while
// keeping 9 or 10 of 10 flight emails.

const FLIGHT_KEYWORDS =
  /\b(flight|itinerar|boarding pass|e-?ticket|booking (confirmation|reference)|reservation|check-?in|departure|PNR)\b/i;

const AIRLINE_SENDERS =
  /(ryanair|wizzair|lufthansa|airbaltic|easyjet|norwegian|finnair|klm|airfrance|swiss|austrian|turkishairlines|lot\.com|sas\.|flysas|vueling|iberia|british-?airways|ba\.com|emirates|qatarairways|latam|delta|united|aa\.com|americanairlines|jetblue|spiritairlines|booking\.com|kiwi\.com|expedia|opodo|edreams|omio|skyscanner)/i;

/** A flight number: an IATA carrier code followed by 2-4 digits. */
export const FLIGHT_NUMBER_PATTERN = /\b(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])\s?\d{2,4}\b/;

/** An explicit route: "VNO → BCN", "FRA - NRT", "LHR to JFK". */
export const ROUTE_PATTERN = /\b[A-Z]{3}\s*(?:→|->|—|–|-|to)\s*[A-Z]{3}\b/;

export interface Candidate {
  subject: string;
  from: string;
  body: string;
}

/** Worth an LLM call? Cheap signals only — this runs on every email. */
export function isLikelyFlightEmail({ subject, from, body }: Candidate): boolean {
  const haystack = `${subject}\n${body}`;
  // Necessary evidence: the email names a flight or a route. Airline branding
  // alone is not enough — most airline mail is marketing.
  const hasFlightEvidence =
    FLIGHT_NUMBER_PATTERN.test(haystack) || ROUTE_PATTERN.test(haystack);
  if (!hasFlightEvidence) return false;

  // With evidence present, a known sender or the usual booking vocabulary
  // confirms it's worth asking about.
  return AIRLINE_SENDERS.test(from) || FLIGHT_KEYWORDS.test(haystack);
}

/** Gmail search query for candidate discovery (brief §15 + Gmail research).
 *  Broad on purpose — the pre-filter and tiers narrow from here. */
export const GMAIL_SEARCH_QUERY =
  'category:travel OR category:reservations OR subject:(flight OR itinerary OR "boarding pass" OR "booking confirmation" OR e-ticket)';
