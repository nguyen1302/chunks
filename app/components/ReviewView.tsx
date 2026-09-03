"use client";
import { useEffect, useRef, useState } from "react";
import type { Expression, ReviewExample } from "@/lib/types";
import { formatShort } from "@/lib/dates";
import SourceLink from "./SourceLink";

type Props = {
  queue: Expression[] | null;
  onStartSession: () => void;
  goAdd: () => void;
  goStats: () => void;
};

export default function ReviewView({ queue, onStartSession, goAdd, goStats }: Props) {
  const [session, setSession] = useState<Expression[]>([]);
  const [qi, setQi] = useState(0);
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [sOk, setSOk] = useState(0);
  const [sNo, setSNo] = useState(0);
  const [history, setHistory] = useState<ReviewExample[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // snapshot the queue once it arrives (Forgot must not requeue in-session)
  useEffect(() => {
    if (queue) {
      setSession(queue);
      setQi(0);
      setDraft("");
      setRevealed(false);
      setDone(false);
      setSOk(0);
      setSNo(0);
    }
  }, [queue]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [qi, session]);

  const cur = session[qi];

  function advance() {
    setHistory(null);
    if (qi + 1 >= session.length) setDone(true);
    else {
      setQi(qi + 1);
      setDraft("");
      setRevealed(false);
    }
  }
  function reveal() {
    if (draft.trim()) setRevealed(true);
  }
  async function mark(ok: boolean) {
    if (!cur || submitting) return; // guard against double-submit on slow API
    setSubmitting(true);
    try {
      await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expressionId: cur.id,
          sentence: draft.trim(),
          result: ok ? "Remembered" : "Forgot",
        }),
      });
    } catch {
      /* keep the session moving even if the write fails */
    }
    setSOk((n) => n + (ok ? 1 : 0));
    setSNo((n) => n + (ok ? 0 : 1));
    setSubmitting(false);
    advance();
  }
  async function loadHistory() {
    if (!cur || historyLoading) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/expressions/${cur.id}/history`);
      setHistory(res.ok ? await res.json() : []);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (done) return;
      if (meta && e.key === "Enter") {
        e.preventDefault();
        reveal();
        return;
      }
      if (revealed && (e.key === "1" || e.key === "2")) {
        const tag = (e.target as HTMLElement)?.tagName ?? "";
        if (tag === "TEXTAREA" || tag === "INPUT") return;
        e.preventDefault();
        mark(e.key === "1");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (queue === null)
    return <div style={{ padding: "120px 0 0", color: "#B4AFA3" }}>Loading…</div>;

  if (done) {
    return (
      <div
        style={{
          padding: "120px 0 0",
          display: "flex",
          flexDirection: "column",
          gap: 22,
          animation: "riseIn 300ms ease both",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: "'Instrument Serif', serif",
            fontWeight: 400,
            fontSize: 44,
            lineHeight: 1.15,
          }}
        >
          {sNo === 0 ? "All of them landed." : "Session done."}
        </h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "#78746B", maxWidth: "46ch" }}>
          {sOk} remembered, {sNo} to work on. Every sentence you wrote is kept, so next time you'll
          see how your usage changes.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          <button onClick={onStartSession} style={btnDark}>
            Review again
          </button>
          <button onClick={goStats} style={btnLight}>
            See progress
          </button>
        </div>
      </div>
    );
  }

  if (!session.length) {
    return (
      <div style={{ padding: "120px 0 0", display: "flex", flexDirection: "column", gap: 20 }}>
        <h1 style={{ margin: 0, fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 40 }}>
          Nothing to review yet.
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: "#78746B" }}>
          Add the first expression you picked up today.
        </p>
        <div>
          <button onClick={goAdd} style={btnDark}>
            Add expression
          </button>
        </div>
      </div>
    );
  }

  const pct = Math.round((qi / Math.max(1, session.length)) * 100) + "%";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "40px 0 44px" }}>
        <div style={{ flex: 1, height: 2, background: "#EDE9E0", position: "relative", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              inset: "0 auto 0 0",
              background: "#A9563C",
              transition: "width 320ms cubic-bezier(.2,.7,.3,1)",
              width: pct,
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11.5,
            color: "#B4AFA3",
            letterSpacing: "0.04em",
          }}
        >
          {Math.min(qi + 1, session.length)} / {session.length}
        </span>
      </div>

      <p
        style={{
          margin: "0 0 18px",
          fontSize: 12.5,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: "#B4AFA3",
        }}
      >
        Use this expression
      </p>
      <h1
        style={{
          margin: 0,
          fontFamily: "'Instrument Serif', serif",
          fontWeight: 400,
          fontSize: 54,
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
        }}
      >
        {cur.text}
      </h1>

      <div style={{ margin: "40px 0 0", borderTop: "1px solid #EDE9E0", paddingTop: 8 }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          ref={inputRef}
          rows={3}
          placeholder="Write your own sentence…"
          style={{
            width: "100%",
            border: "none",
            background: "none",
            resize: "none",
            fontFamily: "'Instrument Serif', serif",
            fontSize: 26,
            lineHeight: 1.5,
            color: "#171614",
            padding: "8px 0",
          }}
        />
      </div>

      {!revealed && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
          <button onClick={reveal} style={btnDark}>
            Check answer
          </button>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: "#C3BEB2" }}>
            ⌘ ↵
          </span>
          <span style={{ flex: 1 }} />
          <button
            onClick={advance}
            style={{ border: "none", background: "none", fontSize: 12.5, color: "#B4AFA3", cursor: "pointer", padding: 6 }}
          >
            Skip
          </button>
        </div>
      )}

      {revealed && (
        <div style={{ animation: "riseIn 260ms ease both" }}>
          <div
            style={{
              marginTop: 34,
              padding: "26px 28px",
              background: "#F4F1E9",
              borderRadius: 3,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <Field label="Meaning">
              <span style={{ fontSize: 17, color: "#171614" }}>{cur.meaning || "—"}</span>
            </Field>
            <Field label="Original example">
              <span
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontSize: 21,
                  lineHeight: 1.45,
                  fontStyle: "italic",
                  color: "#3A3730",
                }}
              >
                {cur.example || "—"}
              </span>
            </Field>
            {cur.source && <SourceLink source={cur.source} />}
          </div>

          {history === null ? (
            <button
              onClick={loadHistory}
              disabled={historyLoading}
              style={{
                border: "none",
                background: "none",
                marginTop: 18,
                fontSize: 13,
                color: "#A9563C",
                cursor: historyLoading ? "default" : "pointer",
                padding: 0,
              }}
            >
              {historyLoading ? "Loading…" : "Show past sentences"}
            </button>
          ) : history.length ? (
            <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 14 }}>
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                  color: "#B4AFA3",
                }}
              >
                Your past sentences
              </span>
              {history.map((h) => (
                <div
                  key={h.id}
                  style={{ display: "flex", gap: 14, alignItems: "baseline", borderLeft: "1px solid #EDE9E0", paddingLeft: 14 }}
                >
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 11,
                      color: "#C3BEB2",
                      minWidth: 52,
                    }}
                  >
                    {h.reviewDate ? formatShort(h.reviewDate) : ""}
                  </span>
                  <span
                    style={{ fontFamily: "'Instrument Serif', serif", fontSize: 19, lineHeight: 1.5, color: "#6D6961" }}
                  >
                    {h.sentence}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span style={{ display: "block", marginTop: 18, fontSize: 13, color: "#B4AFA3" }}>
              No past sentences yet.
            </span>
          )}

          <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => mark(true)} disabled={submitting} style={submitting ? resultBtnDisabled : resultBtn}>
              {submitting ? "Saving…" : <>Remembered <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, opacity: 0.55 }}>1</span></>}
            </button>
            <button onClick={() => mark(false)} disabled={submitting} style={submitting ? resultBtnDisabled : resultBtn}>
              {submitting ? "Saving…" : <>Forgot <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, opacity: 0.55 }}>2</span></>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 11, letterSpacing: "0.09em", textTransform: "uppercase", color: "#A79F90" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

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
const resultBtn: React.CSSProperties = {
  flex: 1,
  border: "1px solid #DCD7CB",
  background: "none",
  padding: 15,
  borderRadius: 2,
  fontSize: 14,
  color: "#171614",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};
const resultBtnDisabled: React.CSSProperties = {
  ...resultBtn,
  cursor: "default",
  color: "#B4AFA3",
  borderColor: "#EDE9E0",
};
