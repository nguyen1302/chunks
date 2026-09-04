"use client";
import { useEffect, useState } from "react";
import type { StudyProgress } from "@/lib/types";

const cap: React.CSSProperties = { fontSize: 11, letterSpacing: "0.09em", textTransform: "uppercase", color: "#B4AFA3" };
const control: React.CSSProperties = {
  border: "1px solid #EDE9E0",
  background: "#FBFAF7",
  borderRadius: 2,
  padding: "7px 10px",
  fontSize: 13,
  color: "#171614",
};

export default function StudyPlanCard() {
  const [p, setP] = useState<StudyProgress | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/study/plan")
      .then((r) => (r.ok ? r.json() : null))
      .then(setP)
      .catch(() => setP(null));
  }, []);

  async function save(next: { enabled: boolean; newPerDay: number; startLevel: string }) {
    setBusy(true);
    try {
      const res = await fetch("/api/study/plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (res.ok) setP(await res.json());
    } finally {
      setBusy(false);
    }
  }

  if (!p) return null;
  const hasBank = p.levels.some((l) => l.total > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={cap}>Oxford 3000 study plan</span>
        <button
          onClick={() => save({ enabled: !p.enabled, newPerDay: p.newPerDay, startLevel: p.startLevel })}
          disabled={busy || !hasBank}
          style={{
            border: "1px solid " + (p.enabled ? "#DCD7CB" : "#171614"),
            background: p.enabled ? "none" : "#171614",
            color: p.enabled ? "#171614" : "#FBFAF7",
            fontSize: 13,
            padding: "8px 16px",
            borderRadius: 2,
            cursor: busy || !hasBank ? "default" : "pointer",
          }}
        >
          {p.enabled ? "Turn off" : "Turn on"}
        </button>
      </div>

      {!hasBank && <span style={{ fontSize: 12.5, color: "#A79F90" }}>Word bank not imported yet.</span>}

      {hasBank && (
        <>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#78746B" }}>
              New words / day
              <select
                value={p.newPerDay}
                onChange={(e) => save({ enabled: p.enabled, newPerDay: Number(e.target.value), startLevel: p.startLevel })}
                style={control}
              >
                {[5, 8, 10, 12, 15, 20, 25, 30].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#78746B" }}>
              Start level
              <select
                value={p.startLevel}
                onChange={(e) => save({ enabled: p.enabled, newPerDay: p.newPerDay, startLevel: e.target.value })}
                style={control}
              >
                {["A1", "A2", "B1", "B2"].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
            <span style={{ fontSize: 12.5, color: "#A79F90" }}>{p.dormantRemaining} words left to introduce</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            {p.levels.map((l) => {
              const pct = l.total ? Math.round((l.activated / l.total) * 100) : 0;
              const solidPct = l.total ? Math.round((l.mastered / l.total) * 100) : 0;
              return (
                <div key={l.level} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#171614", minWidth: 26 }}>{l.level}</span>
                  <span style={{ flex: 1, height: 6, background: "#EDE9E0", position: "relative", borderRadius: 3, overflow: "hidden" }}>
                    <span style={{ position: "absolute", inset: "0 auto 0 0", background: "#C9A98C", width: pct + "%" }} />
                    <span style={{ position: "absolute", inset: "0 auto 0 0", background: "#4E6E52", width: solidPct + "%" }} />
                  </span>
                  <span style={{ fontSize: 12, color: "#A79F90", minWidth: 130, textAlign: "right" }}>
                    {l.activated} learning · {l.mastered} solid / {l.total}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
