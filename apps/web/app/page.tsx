// Frame 1a — the landing. Headline and sub verbatim from the brief (§5).
// The map teaser is a static placeholder until M4 ships the build-time render.
import Link from "next/link";
import { LandingTeaser } from "./LandingTeaser";

const TRUST_ROW = [
  ["Read-only", "We can never send, change, or delete your mail."],
  ["~90 sec", "A typical mailbox imports in about a minute and a half."],
  ["Delete", "Disconnect and erase everything, any time."],
] as const;

export default function Home() {
  return (
    <main>
      <nav className="nav">
        <span className="nav-brand">TRAILHEAD</span>
        <a href="#how-it-works">How it works</a>
        <Link href="/connect" className="btn btn-primary" style={{ padding: "9px 14px", fontSize: 12 }}>
          Connect Gmail
        </Link>
      </nav>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr .95fr",
          borderBottom: "2px solid var(--color-text)",
        }}
        className="hero-grid"
      >
        <div style={{ padding: "44px 28px 34px", borderRight: "2px solid var(--color-text)" }}>
          <h6 style={{ color: "color-mix(in srgb, var(--color-text) 50%, transparent)", marginBottom: 22 }}>
            Zero manual entry
          </h6>
          <h1 style={{ maxWidth: "9.5em", textWrap: "balance" }}>
            See everywhere you&rsquo;ve ever travelled.
          </h1>
          <p className="text-muted" style={{ maxWidth: "24em", margin: "20px 0 28px", fontSize: 15 }}>
            Connect Gmail and automatically reconstruct your flight history.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link href="/connect" className="btn btn-primary">Connect Gmail</Link>
            <a href="#how-it-works" className="btn btn-ghost">How it works / what we read</a>
          </div>
          <div id="how-it-works" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", marginTop: 38, borderTop: "2px solid var(--color-text)" }}>
            {TRUST_ROW.map(([big, small], i) => (
              <div
                key={big}
                style={{
                  padding: i === 0 ? "16px 14px 6px 0" : i === 2 ? "16px 0 6px 14px" : "16px 14px 6px 14px",
                  borderRight: i < 2 ? "1px solid var(--color-divider)" : "none",
                }}
              >
                <div style={{ font: "700 22px/1 var(--font-heading)" }}>{big}</div>
                <p style={{ fontSize: 11.5, marginTop: 9 }} className="text-muted">{small}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, minHeight: 330, position: "relative", overflow: "hidden" }}>
            <LandingTeaser />
            <span style={{ position: "absolute", left: 14, bottom: 14, font: "600 10px/1 var(--font-body)", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>
              Sample route map — not your data
            </span>
          </div>
          <div style={{ borderTop: "2px solid var(--color-text)", padding: 14 }}>
            <span style={{ fontSize: 12 }} className="text-muted">
              Flights only for now — hotels and trains later.
            </span>
          </div>
        </div>
      </section>

      <footer style={{ padding: "14px 28px", display: "flex", gap: 24, fontSize: 12 }} className="text-muted">
        <span>© Trailhead</span>
        <span>Privacy page lands in M6</span>
      </footer>
    </main>
  );
}
