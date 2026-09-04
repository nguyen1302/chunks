"use client";
import { useCallback, useEffect, useState } from "react";
import type { ExpressionWithStats } from "@/lib/types";
import { weaknessWeight, pickWeightedIndex } from "@/lib/practice";
import SourceLink from "./SourceLink";
import SynonymTags from "./SynonymTags";
import SpeakButton from "./SpeakButton";

const btnDark: React.CSSProperties = {
  border: "1px solid #171614",
  background: "#171614",
  color: "#FBFAF7",
  fontSize: 13.5,
  padding: "11px 20px",
  borderRadius: 2,
  cursor: "pointer",
};
const btnLight: React.CSSProperties = {
  border: "1px solid #DCD7CB",
  background: "none",
  fontSize: 13.5,
  padding: "11px 20px",
  borderRadius: 2,
  cursor: "pointer",
  color: "#171614",
};
const cap: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "#A79F90",
};

export default function FlashcardView({ expressions }: { expressions: ExpressionWithStats[] | null }) {
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState<ExpressionWithStats | null>(null);
  const [flipped, setFlipped] = useState(false);

  const drawFrom = useCallback(
    (list: ExpressionWithStats[], exclude: Set<string>) => {
      const pool = list.filter((e) => !exclude.has(e.id));
      if (pool.length === 0) {
        setCurrent(null);
        return;
      }
      const weights = pool.map((e) => weaknessWeight(e));
      const idx = pickWeightedIndex(weights, Math.random());
      setCurrent(pool[idx] ?? pool[0]);
      setFlipped(false);
    },
    [],
  );

  // first draw when data arrives
  useEffect(() => {
    if (expressions && current === null && known.size === 0) drawFrom(expressions, known);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expressions]);

  const next = useCallback(() => {
    if (expressions) drawFrom(expressions, known);
  }, [expressions, known, drawFrom]);

  const markKnown = useCallback(() => {
    if (!current || !expressions) return;
    const nextKnown = new Set(known).add(current.id);
    setKnown(nextKnown);
    drawFrom(expressions, nextKnown);
  }, [current, expressions, known, drawFrom]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (ev.code === "Space") {
        ev.preventDefault();
        setFlipped((f) => !f);
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!expressions) return <div style={{ paddingTop: 48, color: "#B4AFA3" }}>Loading…</div>;

  if (expressions.length === 0) {
    return (
      <div style={{ padding: "120px 0 0", display: "flex", flexDirection: "column", gap: 20 }}>
        <h1 style={{ margin: 0, fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: "clamp(28px, 7vw, 40px)" }}>
          No cards yet.
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: "#78746B" }}>Add a word or phrase to start practicing.</p>
      </div>
    );
  }

  if (!current) {
    return (
      <div style={{ padding: "120px 0 0", display: "flex", flexDirection: "column", gap: 22, animation: "riseIn 300ms ease both" }}>
        <h1 style={{ margin: 0, fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: "clamp(30px, 7vw, 44px)" }}>
          Went through them all.
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: "#78746B" }}>
          You marked {known.size} as known this round. This is practice only — nothing was saved.
        </p>
        <div>
          <button onClick={() => { setKnown(new Set()); drawFrom(expressions, new Set()); }} style={btnDark}>
            Practice again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 48 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 40 }}>
        <span style={cap}>Flashcards · practice only</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: "#C3BEB2" }}>
          space to flip · ↵ next
        </span>
      </div>

      <button
        onClick={() => setFlipped((f) => !f)}
        style={{
          width: "100%",
          minHeight: 220,
          border: "1px solid #EDE9E0",
          background: "#FBFAF7",
          borderRadius: 4,
          cursor: "pointer",
          padding: "clamp(24px, 6vw, 40px) clamp(20px, 5vw, 32px)",
          display: "flex",
          flexDirection: "column",
          gap: 22,
          textAlign: "left",
        }}
      >
        <h1 style={{ margin: 0, fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: "clamp(30px, 8vw, 46px)", lineHeight: 1.1, color: "#171614" }}>
          {current.text} <SpeakButton text={current.text} size={22} />
        </h1>
        {flipped ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "riseIn 200ms ease both" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={cap}>Meaning</span>
              <span style={{ fontSize: 17, color: "#171614" }}>{current.meaning || "—"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={cap}>Original example</span>
              <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, fontStyle: "italic", lineHeight: 1.45, color: "#3A3730" }}>
                {current.example || "—"} <SpeakButton text={current.example} />
              </span>
            </div>
            {current.synonyms.length > 0 && <SynonymTags synonyms={current.synonyms} />}
            {current.source && <SourceLink source={current.source} />}
          </div>
        ) : (
          <span style={{ fontSize: 13, color: "#C3BEB2" }}>Tap to reveal meaning & example</span>
        )}
      </button>

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <button onClick={next} style={btnDark}>Next card</button>
        <button onClick={markKnown} style={btnLight}>I know this one</button>
      </div>
    </div>
  );
}
