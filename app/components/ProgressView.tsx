"use client";
import type { Stats } from "@/lib/types";
import { formatShort } from "@/lib/dates";
import ReminderToggle from "./ReminderToggle";

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
const big: React.CSSProperties = {
  fontFamily: "'Instrument Serif', serif",
  fontSize: "clamp(28px, 8vw, 40px)",
  lineHeight: 1,
};
const sub: React.CSSProperties = { fontSize: 12.5, color: "#A79F90" };
const sectionGap = 52;

const MASTERY: { key: keyof Stats["mastery"]; label: string; color: string }[] = [
  { key: "new", label: "New", color: "#E3DCCE" },
  { key: "learning", label: "Learning", color: "#C9A98C" },
  { key: "solid", label: "Solid", color: "#A9563C" },
  { key: "mastered", label: "Mastered", color: "#4E6E52" },
];

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
  const masteryTotal = MASTERY.reduce((n, m) => n + stats.mastery[m.key], 0);
  const graded = stats.remembered + stats.forgot;

  return (
    <div style={{ paddingTop: 48 }}>
      <h1 style={{ margin: "0 0 24px", fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: "clamp(26px, 6vw, 36px)" }}>
        Progress
      </h1>

      <div style={{ padding: "16px 0 28px", borderBottom: "1px solid #EDE9E0", marginBottom: 24 }}>
        <ReminderToggle />
      </div>

      {/* headline tiles */}
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
          <span style={sub}>words & phrases</span>
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

      {/* activity strip */}
      <div style={{ marginTop: sectionGap }}>
        <span style={cap}>Activity</span>
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 1,
            background: "#EDE9E0",
            border: "1px solid #EDE9E0",
          }}
        >
          <MiniStat n={stats.activity.reviewsToday} label="reviews today" />
          <MiniStat n={stats.activity.reviewsThisWeek} label="this week" />
          <MiniStat n={stats.activity.totalReviews} label="reviews all-time" />
          <MiniStat n={stats.activity.dueToday} label="due now" accent={stats.activity.dueToday > 0} />
          <MiniStat n={stats.streak.current} label="day streak" />
          <MiniStat n={stats.streak.best} label="best streak" />
        </div>
      </div>

      {/* mastery breakdown */}
      <div style={{ marginTop: sectionGap }}>
        <span style={cap}>Mastery</span>
        <div style={{ marginTop: 16, display: "flex", height: 10, borderRadius: 2, overflow: "hidden", background: "#EDE9E0" }}>
          {masteryTotal > 0 &&
            MASTERY.map((m) => {
              const w = (stats.mastery[m.key] / masteryTotal) * 100;
              return w > 0 ? <span key={m.key} style={{ width: `${w}%`, background: m.color }} /> : null;
            })}
        </div>
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: "10px 20px" }}>
          {MASTERY.map((m) => (
            <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: m.color, display: "inline-block" }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "#171614" }}>
                {stats.mastery[m.key]}
              </span>
              <span style={{ fontSize: 13, color: "#A79F90" }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* remembered vs forgot */}
      <div style={{ marginTop: sectionGap }}>
        <span style={cap}>Remembered vs forgot</span>
        <div style={{ marginTop: 16, display: "flex", height: 10, borderRadius: 2, overflow: "hidden", background: "#EDE9E0" }}>
          {graded > 0 && (
            <>
              <span style={{ width: `${(stats.remembered / graded) * 100}%`, background: "#4E6E52" }} />
              <span style={{ width: `${(stats.forgot / graded) * 100}%`, background: "#A9563C" }} />
            </>
          )}
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 24 }}>
          <Legend color="#4E6E52" n={stats.remembered} label="remembered" />
          <Legend color="#A9563C" n={stats.forgot} label="forgot" />
        </div>
      </div>

      {/* needs attention */}
      <div style={{ marginTop: sectionGap, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <span style={cap}>Needs attention</span>
          {stats.needsAttention.length > 0 && (
            <button
              onClick={onStartSession}
              style={{ border: "none", background: "none", fontSize: 13, color: "#A9563C", cursor: "pointer", padding: 0 }}
            >
              Review these →
            </button>
          )}
        </div>
        {stats.needsAttention.length === 0 && (
          <span style={sub}>Nothing needs attention right now — nice.</span>
        )}
        {stats.needsAttention.map((w) => (
          <div
            key={w.id}
            style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "13px 0", borderBottom: "1px solid #F2EFE8" }}
          >
            <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 21, flex: 1, minWidth: 0 }}>{w.text}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#C3BEB2", whiteSpace: "nowrap" }}>
              Lv {w.level} · due {formatShort(w.due)}
            </span>
            <span style={{ fontSize: 13, color: "#A79F90", whiteSpace: "nowrap" }}>
              {w.forgot} forgot · {w.remembered} remembered
            </span>
            <span style={{ width: 64, height: 3, background: "#EDE9E0", position: "relative", overflow: "hidden" }}>
              <span style={{ position: "absolute", inset: "0 auto 0 0", background: "#A9563C", width: Math.round(w.forgotRate * 100) + "%" }} />
            </span>
          </div>
        ))}
      </div>

      {/* last 14 days */}
      <div style={{ marginTop: sectionGap, display: "flex", flexDirection: "column", gap: 14 }}>
        <span style={cap}>Last 14 days</span>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56 }}>
          {stats.last14Days.map((b, i) => (
            <span
              key={i}
              title={`${b} review${b === 1 ? "" : "s"}`}
              style={{ flex: 1, background: "#E3DCCE", borderRadius: 1, minHeight: 2, height: Math.round((b / peak) * 100) + "%" }}
            />
          ))}
        </div>
        <span style={sub}>{activeDays} of the last 14 days had a review.</span>
      </div>
    </div>
  );
}

function MiniStat({ n, label, accent }: { n: number; label: string; accent?: boolean }) {
  return (
    <div style={{ background: "#FBFAF7", padding: "16px 16px 18px", display: "flex", flexDirection: "column", gap: 5 }}>
      <span
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 28,
          lineHeight: 1,
          color: accent ? "#A9563C" : "#171614",
        }}
      >
        {n}
      </span>
      <span style={{ fontSize: 12, color: "#A79F90" }}>{label}</span>
    </div>
  );
}

function Legend({ color, n, label }: { color: string; n: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: "inline-block" }} />
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "#171614" }}>{n}</span>
      <span style={{ fontSize: 13, color: "#A79F90" }}>{label}</span>
    </div>
  );
}
