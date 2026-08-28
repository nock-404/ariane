"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="de">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#eef1f1",
          color: "#1c2523",
          margin: 0,
        }}
      >
        <div style={{ maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>Ariane ist gestolpert</h1>
          <p style={{ fontSize: 14, color: "#6a7a78", margin: "0 0 16px" }}>
            Da ist etwas grundsätzlich schiefgegangen. Ein zweiter Versuch hilft meistens.
          </p>
          <button
            onClick={reset}
            style={{
              border: "1px solid #57795a",
              background: "#57795a",
              color: "#f4f7f4",
              borderRadius: 8,
              padding: "6px 12px",
              font: "inherit",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Neu laden
          </button>
        </div>
      </body>
    </html>
  );
}
