"use client";
import type { Stats } from "@/lib/types";

const cap: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "#B4AFA3",
};
const tile: React.CSSProperties = {
  background: "#FBFAF7",
  padding: "22px 20px 24px",
  display: "flex",
  flexDirection: "column",
  gap: 7,
};
const big: React.CSSProperties = { fontFamily: "'Instrument Serif', serif", fontSize: 40, lineHeight: 1 };
const sub: React.CSSProperties = { fontSize: 12.5, color: "#A79F90" };

export default function ProgressView({
  stats,
  onStartSession,
}: {
  stats: Stats | null;
  onStartSession: () => void;
}) {
  if (!stats) return <div style={{ paddingTop: 48, color: "#B4AFA3" }}>Loading…</div>;
  const peak = Math.max(1, ...stats.last14Days);
  const activeDays = stats.last14Days.filter((b) => b > 0).length;
  return (
    <div style={{ paddingTop: 48 }}>
      <h1 style={{ margin: "0 0 40px", fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 36 }}>
        Progress
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1,
          background: "#EDE9E0",
          borderTop: "1px solid #EDE9E0",
          borderBottom: "1px solid #EDE9E0",
        }}
      >
        <div style={tile}>
          <span style={big}>{stats.total}</span>
          <span style={sub}>expressions collected</span>
        </div>
        <div style={tile}>
          <span style={big}>{stats.sentences}</span>
          <span style={sub}>sentences you wrote</span>
        </div>
        <div style={tile}>
          <span style={big}>{Math.round(stats.rememberedRate * 100)}%</span>
          <span style={sub}>remembered rate</span>
        </div>
      </div>

      <div style={{ marginTop: 52, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={cap}>Needs attention</span>
          <button
            onClick={onStartSession}
            style={{ border: "none", background: "none", fontSize: 13, color: "#A9563C", cursor: "pointer", padding: 0 }}
          >
            Review these →
          </button>
        </div>
        {stats.needsAttention.length === 0 && (
          <span style={sub}>Nothing flagged yet — keep reviewing.</span>
        )}
        {stats.needsAttention.map((w) => (
          <div
            key={w.id}
            style={{
              display: "flex",
              gap: 18,
              alignItems: "center",
              padding: "13px 0",
              borderBottom: "1px solid #F2EFE8",
            }}
          >
            <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 21, flex: 1 }}>{w.text}</span>
            <span style={{ fontSize: 13, color: "#A79F90", textAlign: "right", minWidth: 110 }}>
              {w.forgot} forgot · {w.remembered} remembered
            </span>
            <span style={{ width: 64, height: 3, background: "#EDE9E0", position: "relative", overflow: "hidden" }}>
              <span
                style={{
                  position: "absolute",
                  inset: "0 auto 0 0",
                  background: "#A9563C",
                  width: Math.round(w.forgotRate * 100) + "%",
                }}
              />
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 52, display: "flex", flexDirection: "column", gap: 14 }}>
        <span style={cap}>Last 14 days</span>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56 }}>
          {stats.last14Days.map((b, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                background: "#E3DCCE",
                borderRadius: 1,
                minHeight: 2,
                height: Math.round((b / peak) * 100) + "%",
              }}
            />
          ))}
        </div>
        <span style={sub}>{activeDays} of the last 14 days had a review.</span>
      </div>
    </div>
  );
}
