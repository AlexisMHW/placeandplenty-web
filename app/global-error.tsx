"use client";

// The last-resort boundary: an error thrown in the ROOT layout itself,
// which app/error.tsx cannot catch because it renders inside that layout.
//
// It therefore has to supply its own <html> and <body> — nothing above it
// survived. That also means no fonts and no Tailwind, since the root
// layout is what loads globals.css. Everything below is inline, in the
// Place & Plenty palette, using the same font stacks the CSS variables
// would have resolved to.
//
// In practice this should never render. When it does, the page is
// essentially unrecoverable, so it offers exactly one thing: a reload.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("Root layout error:", error);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FAF8F3",
          color: "#1F3D2E",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "34rem" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              opacity: 0.75,
            }}
          >
            Place &amp; Plenty
          </p>
          <h1
            style={{
              margin: "1rem 0 0",
              fontFamily: "Georgia, serif",
              fontSize: "2rem",
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            Something went badly wrong.
          </h1>
          <p style={{ margin: "1rem 0 0", fontSize: "1.05rem", opacity: 0.8 }}>
            The page couldn&rsquo;t load at all. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "2rem",
              border: 0,
              borderRadius: "999px",
              backgroundColor: "#1F3D2E",
              color: "#FAF8F3",
              padding: "0.9rem 1.75rem",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
