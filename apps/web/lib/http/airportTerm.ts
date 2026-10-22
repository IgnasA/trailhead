// The airport search builds a PostgREST `or=(...)` filter string from what the
// person typed. PostgREST gives commas, parentheses, dots, colons, quotes,
// backslashes and `*` meaning inside that string, and `%`/`_` are LIKE
// wildcards — so rather than strip a list of known-bad characters, keep only
// what an airport code, city or name is made of.
const MAX_TERM = 64;

export function airportSearchTerm(q: string): string {
  return q
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}' -]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TERM);
}
