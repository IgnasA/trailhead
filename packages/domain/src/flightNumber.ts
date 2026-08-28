/** Airlines write the same flight as "7Q-1912", "7Q 1912", "1912", "01912".
 *  Merging is keyed on the flight, so the number must be normalized first or
 *  the same segment becomes two flights. */
export function normalizeFlightNumber(
  raw: string | null,
  airlineIata: string | null,
): string | null {
  if (!raw) return null;
  let s = raw.toUpperCase().replace(/[\s\-_.]/g, "");
  const code = airlineIata?.toUpperCase();
  if (code && s.startsWith(code) && /^\d{1,5}$/.test(s.slice(code.length))) {
    s = s.slice(code.length);
  } else {
    // No airline known: strip a leading carrier code only when it has a real
    // IATA shape (LH, 7Q, W6) and the rest is unambiguously a flight number.
    const m = s.match(/^(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])(\d{1,5})$/);
    if (m?.[1]) s = m[1];
  }
  s = s.replace(/^0+/, "");
  return s === "" ? null : s;
}
