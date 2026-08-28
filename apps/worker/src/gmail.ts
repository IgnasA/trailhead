// Minimal Gmail REST client (raw fetch — the surface is 4 endpoints).
// Quota notes from the Gmail research: list=5u, get=20u, 6000u/min/user.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Auth failures are distinct from transport failures: one means "an operator
 *  must fix credentials", the other "the user must reconnect". The pipeline
 *  turns these into user-facing states rather than a generic dead end. */
export class GmailAuthError extends Error {
  constructor(
    readonly code: "bad_client_credentials" | "token_revoked" | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "GmailAuthError";
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new GmailAuthError(
      "bad_client_credentials",
      "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET not set",
    );
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    // invalid_client = our credentials are wrong (operator problem).
    // invalid_grant  = the user's token is revoked/expired (reconnect).
    const code =
      body.error === "invalid_client"
        ? "bad_client_credentials"
        : body.error === "invalid_grant"
          ? "token_revoked"
          : "unknown";
    throw new GmailAuthError(code, `token refresh failed: ${res.status} ${body.error ?? ""}`.trim());
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function gget<T>(accessToken: string, path: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 4) throw new Error(`gmail ${path.split("?")[0]}: ${res.status}`);
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`gmail ${path.split("?")[0]}: ${res.status}`);
    return (await res.json()) as T;
  }
}

export async function listAllMessageIds(
  accessToken: string,
  query: string,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const page = await gget<{
      messages?: { id: string }[];
      nextPageToken?: string;
    }>(
      accessToken,
      `/messages?maxResults=500&q=${encodeURIComponent(query)}${pageToken ? `&pageToken=${pageToken}` : ""}`,
    );
    ids.push(...(page.messages ?? []).map((m) => m.id));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return ids;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

export interface FetchedEmail {
  id: string;
  subject: string;
  from: string;
  receivedAt: string | null;
  html: string;
  text: string;
}

const b64url = (data: string) =>
  Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

function collectBodies(part: GmailPart | undefined, out: { html: string[]; text: string[] }) {
  if (!part) return;
  if (part.body?.data) {
    if (part.mimeType === "text/html") out.html.push(b64url(part.body.data));
    else if (part.mimeType === "text/plain") out.text.push(b64url(part.body.data));
  }
  for (const p of part.parts ?? []) collectBodies(p, out);
}

export async function fetchEmail(accessToken: string, id: string): Promise<FetchedEmail> {
  const msg = await gget<{
    internalDate?: string;
    payload?: GmailPart & { headers?: { name: string; value: string }[] };
  }>(accessToken, `/messages/${id}?format=full`);
  const headers = msg.payload?.headers ?? [];
  const h = (name: string) =>
    headers.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  const bodies = { html: [] as string[], text: [] as string[] };
  collectBodies(msg.payload, bodies);
  return {
    id,
    subject: h("Subject"),
    from: h("From"),
    receivedAt: msg.internalDate
      ? new Date(Number(msg.internalDate)).toISOString()
      : null,
    html: bodies.html.join("\n"),
    text: bodies.text.join("\n"),
  };
}
