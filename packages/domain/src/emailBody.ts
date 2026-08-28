// Email normalization (brief §16): airline mail is table-heavy HTML with
// tracking pixels and CSS, and its plain-text parts are padded with long CRLF
// runs. Sending either raw to the model costs many times the tokens and
// buries the values. This produces clean text while preserving what matters —
// codes, numbers, dates, times, prices.

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
  "&quot;": '"', "&#39;": "'", "&apos;": "'", "&mdash;": "—", "&ndash;": "–",
};

/** Collapse the padding: CRLF runs, repeated spaces, and blank-line stacks.
 *  A real Wizz Air itinerary arrived as 8.5k chars of which 2.3k were CRLF. */
export function tidyText(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // Block-level boundaries become newlines so table cells don't run together
    // ("FRA17:05" would hide a departure time from the model).
    .replace(/<\/(tr|div|p|table|h[1-6]|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "\t")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? " ");
  return tidyText(stripped);
}

/** What the LLM tier reads, and what "view source" shows: plain text when the
 *  email has a real one, otherwise flattened HTML — capped so one enormous
 *  email can't dominate a job's token budget. 6k chars ≈ 1.5k tokens: a
 *  70-email sample of a real mailbox averaged 5,217 chars, with only a third
 *  exceeding the cap, and every route/flight-number match in that sample fell
 *  inside the first 6k. */
export function bodyForExtraction(text: string, html: string, maxChars = 6000): string {
  const plain = tidyText(text);
  const source = plain.length > 200 ? plain : htmlToText(html);
  return source.slice(0, maxChars);
}
