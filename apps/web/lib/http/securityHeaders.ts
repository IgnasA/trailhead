// Response headers for every route. The CSP here is deliberately the part that
// can't break the app — no framing, no plugins, no <base> or form hijacking.
// A script-src policy needs nonces wired through Next's rendering and MapLibre's
// workers, and is a recommendation in docs/SECURITY_REVIEW.md, not a header yet.
export const SECURITY_HEADERS: { key: string; value: string }[] = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];
