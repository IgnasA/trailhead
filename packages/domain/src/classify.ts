// Deterministic pre-filter: decides which tier-1/2 misses are worth an LLM
// call. Cheap by design (pipeline ticket: this keeps the LLM set small).

const FLIGHT_KEYWORDS =
  /\b(flight|itinerar|boarding pass|e-?ticket|booking (confirmation|reference)|reservation|check-?in|departure|PNR)\b/i;

const AIRLINE_SENDERS =
  /(ryanair|wizzair|lufthansa|airbaltic|easyjet|norwegian|finnair|klm|airfrance|swiss|austrian|turkishairlines|lot\.com|sas\.|vueling|iberia|british-?airways|ba\.com|emirates|qatarairways|latam|delta|united|aa\.com|americanairlines|jetblue|booking\.com|kiwi\.com|expedia|opodo|edreams|omio|skyscanner)/i;

export function isLikelyFlightEmail(subject: string, from: string): boolean {
  return AIRLINE_SENDERS.test(from) || FLIGHT_KEYWORDS.test(subject);
}

/** Gmail search query for candidate discovery (brief §15 + Gmail research).
 *  Broad on purpose — the pre-filter and tiers narrow from here. */
export const GMAIL_SEARCH_QUERY =
  'category:travel OR category:reservations OR subject:(flight OR itinerary OR "boarding pass" OR "booking confirmation" OR e-ticket)';
