// Validation for a typed-in flight, before it reaches the definer RPCs.
//
// The database enforces the shape it cares about (airport foreign keys, the
// airline and currency patterns), but free-text fields are plain `text` with no
// limit, and a type error in Postgres surfaces as a 500. Checking here bounds
// what one request can store and turns bad input into a 400 with a sentence.

export interface ManualFlightInput {
  origin: string;
  dest: string;
  date: string;
  airline: string | null;
  flightNumber: string | null;
  depTime: string | null;
  arrTime: string | null;
  bookingRef: string | null;
  price: number | null;
  currency: string | null;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const IATA = /^[A-Z]{3}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
/** numeric(10, 2) holds up to 99,999,999.99. */
const MAX_PRICE = 99_999_999.99;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

function isRealDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Empty and absent both mean "not stated". */
function optionalText(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (t === "") return null;
  return t.length <= max ? t : undefined;
}

export function parseManualFlight(body: unknown): Parsed<ManualFlightInput> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "That request wasn't readable." };
  const b = body as Record<string, unknown>;

  const origin = typeof b.origin === "string" ? b.origin.toUpperCase() : "";
  const dest = typeof b.dest === "string" ? b.dest.toUpperCase() : "";
  if (!IATA.test(origin) || !IATA.test(dest)) return { ok: false, error: "Pick a departure and an arrival airport." };
  if (origin === dest) return { ok: false, error: "A flight has to go somewhere else." };
  if (!isRealDate(b.date)) return { ok: false, error: "Pick a date." };

  const airline = optionalText(b.airline, 3);
  const flightNumber = optionalText(b.flightNumber, 16);
  const bookingRef = optionalText(b.bookingRef, 32);
  const currency = optionalText(b.currency, 3);
  if (airline === undefined || (airline !== null && !/^[A-Za-z0-9]{2}$/.test(airline))) return { ok: false, error: "An airline code is two letters or digits." };
  if (flightNumber === undefined) return { ok: false, error: "That flight number is too long." };
  if (bookingRef === undefined) return { ok: false, error: "That booking reference is too long." };
  if (currency === undefined || (currency !== null && !/^[A-Za-z]{3}$/.test(currency))) {
    return { ok: false, error: "A currency is a three-letter code." };
  }

  const depTime = optionalText(b.depTime, 8);
  const arrTime = optionalText(b.arrTime, 8);
  if (depTime === undefined || (depTime !== null && !TIME.test(depTime)) ||
      arrTime === undefined || (arrTime !== null && !TIME.test(arrTime))) {
    return { ok: false, error: "Times are hours and minutes, like 07:45." };
  }

  let price: number | null = null;
  if (b.price !== undefined && b.price !== null && b.price !== "") {
    if (typeof b.price !== "number" || !Number.isFinite(b.price) || b.price < 0 || b.price > MAX_PRICE) {
      return { ok: false, error: "That price doesn't look right." };
    }
    price = b.price;
  }

  return {
    ok: true,
    value: { origin, dest, date: b.date, airline, flightNumber, depTime, arrTime, bookingRef, price, currency },
  };
}

/** Request bodies are tiny; anything larger is not this form. */
export const MAX_BODY_BYTES = 8 * 1024;

export async function readJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return undefined;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
