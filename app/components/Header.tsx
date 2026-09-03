"use client";

type View = "review" | "add" | "stats";

const tab: React.CSSProperties = {
  border: "none",
  background: "none",
  padding: "6px 10px 8px",
  fontSize: 13.5,
  color: "#171614",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
};

export default function Header({ view, setView }: { view: View; setView: (v: View) => void }) {
  const items: [View, string][] = [
    ["review", "Review"],
    ["add", "Add"],
    ["stats", "Progress"],
  ];
  return (
    <header
      style={{
        width: "100%",
        maxWidth: 780,
        padding: "28px 32px 0",
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, letterSpacing: "0.01em" }}>
          chunks
        </span>
        <span
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            color: "#B4AFA3",
            letterSpacing: "0.06em",
          }}
        >
          EN
        </span>
      </div>
      <nav style={{ display: "flex", gap: 4 }}>
        {items.map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={tab}>
            {label}
            {view === v && (
              <span style={{ display: "block", width: "100%", height: 1.5, background: "#A9563C" }} />
            )}
          </button>
        ))}
      </nav>
    </header>
  );
}
