"use client";

/** Shown instead of the bare "A server error occurred" page when something fails before the layout can render (usually the database). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0b0b0d", color: "#f4f4f5", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "96px 24px" }}>
          <p style={{ letterSpacing: ".2em", fontSize: 12, opacity: 0.6, margin: 0 }}>SPORTIQ</p>
          <h1 style={{ fontSize: 32, margin: "12px 0" }}>We hit a snag</h1>
          <p style={{ opacity: 0.8, lineHeight: 1.6 }}>
            The store could not load right now. This is usually temporary (for example the database is still starting). Please try again in a moment.
          </p>
          <p style={{ opacity: 0.6, fontSize: 14, lineHeight: 1.6 }}>
            Shop owner: check that MySQL is running and that DATABASE_URL is correct, then see the terminal window for the exact error.
          </p>
          <button onClick={() => reset()} style={{ marginTop: 16, padding: "12px 20px", background: "#c8ff3d", color: "#0b0b0d", border: 0, fontWeight: 700, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
