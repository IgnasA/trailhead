// M0 shell only — the real landing (wireframe 1a) is an M1 slice.
export default function Home() {
  return (
    <main>
      <nav className="nav">
        <span className="nav-brand">TRAILHEAD</span>
      </nav>
      <section style={{ maxWidth: 820, padding: "64px 28px" }}>
        <h6 style={{ color: "var(--color-accent)" }}>Zero manual entry</h6>
        <h1 style={{ maxWidth: "9.5em" }}>
          See everywhere you&rsquo;ve ever travelled.
        </h1>
        <p className="text-muted" style={{ maxWidth: "24em" }}>
          Connect Gmail and automatically reconstruct your flight history.
        </p>
        <button className="btn btn-primary" disabled>
          Connect Gmail
        </button>
      </section>
    </main>
  );
}
