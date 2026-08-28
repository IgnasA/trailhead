// Email normalization (brief §16): airline mail is table-heavy HTML with
// tracking pixels and CSS. Sending it raw to the model costs many times the
// tokens and buries the values. This produces clean text while preserving
// what matters — codes, numbers, dates, times, prices.

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
  "&quot;": '"', "&#39;": "'", "&apos;": "'", "&mdash;": "—", "&ndash;": "–",
};

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // Block-level boundaries become newlines so table cells don't run together
    // ("FRA17:05" would hide a departure time from the model).
    .replace(/<\/(tr|div|p|table|h[1-6]|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "\t")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? " ")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** What the LLM tier actually reads: plain text when the email has it,
 *  otherwise flattened HTML, capped so one enormous email can't dominate a
 *  job's token budget. */
export function bodyForExtraction(text: string, html: string, maxChars = 12000): string {
  const source = text.trim().length > 200 ? text : htmlToText(html);
  return source.slice(0, maxChars);
}
