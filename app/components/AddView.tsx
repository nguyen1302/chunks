"use client";
import { useEffect, useRef, useState } from "react";
import type { Expression } from "@/lib/types";

const label: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  borderBottom: "1px solid #EDE9E0",
  padding: "16px 0",
};
const cap: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "#B4AFA3",
};
const bare: React.CSSProperties = { border: "none", background: "none", color: "#171614" };

export default function AddView({ onAdded }: { onAdded: () => void }) {
  const [f, setF] = useState({ expr: "", meaning: "", example: "", source: "" });
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState<{ text: string; meaning: string }[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setTimeout(() => ref.current?.focus(), 60);
  }, []);

  async function save() {
    if (saving) return; // guard against double-submit on slow API
    if (!f.expr.trim()) {
      ref.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/expressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: f.expr, meaning: f.meaning, example: f.example, source: f.source }),
      });
      if (!res.ok) return;
      const created: Expression = await res.json();
      setRecent((r) => [{ text: created.text, meaning: created.meaning }, ...r].slice(0, 5));
      setSaved(created.text);
      setF({ expr: "", meaning: "", example: "", source: "" });
      onAdded();
      setTimeout(() => ref.current?.focus(), 40);
      setTimeout(() => setSaved(""), 2600);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div style={{ paddingTop: 48 }}>
      <h1
        style={{ margin: "0 0 36px", fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 36 }}
      >
        New expression
      </h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <label style={label}>
          <span style={cap}>Expression</span>
          <input
            ref={ref}
            value={f.expr}
            onChange={(e) => setF({ ...f, expr: e.target.value })}
            placeholder="run into a problem"
            style={{ ...bare, fontFamily: "'Instrument Serif', serif", fontSize: 30, padding: "2px 0" }}
          />
        </label>
        <label style={label}>
          <span style={cap}>Meaning</span>
          <input
            value={f.meaning}
            onChange={(e) => setF({ ...f, meaning: e.target.value })}
            placeholder="gặp phải một vấn đề"
            style={{ ...bare, fontSize: 17, padding: "2px 0" }}
          />
        </label>
        <label style={label}>
          <span style={cap}>Original example</span>
          <textarea
            value={f.example}
            onChange={(e) => setF({ ...f, example: e.target.value })}
            rows={2}
            placeholder="I ran into a problem while working on the project."
            style={{
              ...bare,
              resize: "none",
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontSize: 20,
              lineHeight: 1.5,
              padding: "2px 0",
            }}
          />
        </label>
        <label style={label}>
          <span style={cap}>
            Source{" "}
            <span style={{ textTransform: "none", letterSpacing: 0, color: "#C3BEB2" }}>optional</span>
          </span>
          <input
            value={f.source}
            onChange={(e) => setF({ ...f, source: e.target.value })}
            placeholder="YouTube · article · URL"
            style={{ ...bare, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, padding: "4px 0" }}
          />
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 26 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            border: "1px solid #171614",
            background: saving ? "#B4AFA3" : "#171614",
            borderColor: saving ? "#B4AFA3" : "#171614",
            color: "#FBFAF7",
            fontSize: 13.5,
            padding: "11px 22px",
            borderRadius: 2,
            cursor: saving ? "default" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: "#C3BEB2" }}>
          ⌘ ↵
        </span>
        {saved && (
          <span style={{ fontSize: 13, color: "#4E6E52", animation: "riseIn 200ms ease both" }}>
            Saved — {saved}
          </span>
        )}
      </div>
      {recent.length > 0 && (
        <div style={{ marginTop: 64, display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={cap}>Recently added</span>
          {recent.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 16,
                alignItems: "baseline",
                padding: "9px 0",
                borderBottom: "1px solid #F2EFE8",
              }}
            >
              <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, flex: 1 }}>
                {r.text}
              </span>
              <span style={{ fontSize: 13.5, color: "#A79F90" }}>{r.meaning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
