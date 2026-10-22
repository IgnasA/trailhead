// CSRF defence in depth for the cookie-authenticated API routes.
//
// Supabase's session cookies are SameSite=Lax, which already keeps them off a
// cross-site POST. This is the second lock: a state-changing request has to say
// it came from this origin. Browsers always send Origin on POST/PATCH/DELETE
// (and on any cross-origin fetch), so a missing header means a non-browser
// client — which has no cookies to ride on — and is allowed through.
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) {
    // Older browsers omit Origin on same-origin requests but do send
    // Sec-Fetch-Site; trust that when it is present.
    const site = request.headers.get("sec-fetch-site");
    return site === null || site === "same-origin" || site === "none";
  }
  if (origin === "null") return false; // sandboxed iframes, data: URLs
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return host !== null && new URL(origin).host === host;
  } catch {
    return false;
  }
}
