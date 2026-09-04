"use client";
import { useMemo, useState } from "react";
import type { ExpressionWithStats, ReviewExample } from "@/lib/types";
import { formatShort } from "@/lib/dates";
import { formatSynonyms } from "@/lib/synonyms";
import SourceLink from "./SourceLink";
import SynonymTags from "./SynonymTags";
import SpeakButton from "./SpeakButton";

type Sort = "newest" | "hardest" | "due";

const cap: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "#B4AFA3",
};
const control: React.CSSProperties = {
  border: "1px solid #EDE9E0",
  background: "#FBFAF7",
  borderRadius: 2,
  padding: "8px 10px",
  fontSize: 13,
  color: "#171614",
};

function isWeak(e: ExpressionWithStats): boolean {
  return e.reviewCount === 0 || e.level < 3 || e.forgotRate >= 0.5;
}

export default function LibraryView({
  expressions,
  onReload,
}: {
  expressions: ExpressionWithStats[] | null;
  onReload: () => void;
}) {
  const [q, setQ] = useState("");
  const [weakOnly, setWeakOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!expressions) return [];
    const needle = q.trim().toLowerCase();
    let list = expressions.filter(
      (e) =>
        !needle ||
        e.text.toLowerCase().includes(needle) ||
        e.meaning.toLowerCase().includes(needle),
    );
    if (weakOnly) list = list.filter(isWeak);
    const sorted = [...list];
    if (sort === "newest") sorted.sort((a, b) => (a.added < b.added ? 1 : -1));
    else if (sort === "hardest")
      sorted.sort((a, b) => b.forgotRate - a.forgotRate || b.reviewCount - a.reviewCount);
    else sorted.sort((a, b) => (a.reviewDue > b.reviewDue ? 1 : -1));
    return sorted;
  }, [expressions, q, weakOnly, sort]);

  if (!expressions) return <div style={{ paddingTop: 48, color: "#B4AFA3" }}>Loading…</div>;

  return (
    <div style={{ paddingTop: 48 }}>
      <h1 style={{ margin: "0 0 28px", fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: "clamp(26px, 6vw, 36px)" }}>
        Library
      </h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search word, phrase, or meaning…"
          style={{ ...control, flex: 1, minWidth: 200 }}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={control}>
          <option value="newest">Newest</option>
          <option value="hardest">Hardest</option>
          <option value="due">Due soonest</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#78746B", cursor: "pointer" }}>
          <input type="checkbox" checked={weakOnly} onChange={(e) => setWeakOnly(e.target.checked)} />
          Needs work
        </label>
      </div>
      <div style={{ ...cap, marginBottom: 20 }}>{rows.length} words & phrases</div>

      {rows.length === 0 && <div style={{ color: "#A79F90", fontSize: 14 }}>No words or phrases match.</div>}

      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map((e) => (
          <LibraryRow
            key={e.id}
            e={e}
            open={openId === e.id}
            onToggle={() => setOpenId(openId === e.id ? null : e.id)}
            onReload={onReload}
          />
        ))}
      </div>
    </div>
  );
}

function statusLabel(e: ExpressionWithStats): string {
  if (e.reviewCount === 0) return "not reviewed";
  const graded = e.remembered + e.forgot;
  const rate = graded ? Math.round((e.remembered / graded) * 100) + "% recall" : "no graded reviews";
  return `Lv ${e.level} · ${rate}`;
}

function LibraryRow({
  e,
  open,
  onToggle,
  onReload,
}: {
  e: ExpressionWithStats;
  open: boolean;
  onToggle: () => void;
  onReload: () => void;
}) {
  const [history, setHistory] = useState<ReviewExample[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ text: "", meaning: "", example: "", source: "", synonyms: "" });
  const [editSaving, setEditSaving] = useState(false);

  function startEdit() {
    setForm({
      text: e.text,
      meaning: e.meaning,
      example: e.example,
      source: e.source,
      synonyms: formatSynonyms(e.synonyms),
    });
    setEditing(true);
  }

  async function saveEdit() {
    if (editSaving || !form.text.trim()) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/expressions/${e.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setEditing(false);
        onReload();
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function loadHistory() {
    setLoading(true);
    try {
      const res = await fetch(`/api/expressions/${e.id}/history`);
      setHistory(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    onToggle();
    if (!open && history === null) loadHistory();
  }

  async function addPast() {
    const sentence = draft.trim();
    if (!sentence || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/expressions/${e.id}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence }),
      });
      if (res.ok) {
        const created: ReviewExample = await res.json();
        setHistory((h) => [created, ...(h ?? [])]);
        setDraft("");
        onReload();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ borderBottom: "1px solid #F2EFE8" }}>
      <button
        onClick={toggle}
        style={{
          width: "100%",
          border: "none",
          background: "none",
          cursor: "pointer",
          display: "flex",
          gap: 12,
          alignItems: "baseline",
          flexWrap: "wrap",
          padding: "14px 0",
          textAlign: "left",
        }}
      >
        <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 21, flex: 1, minWidth: 0, color: "#171614" }}>
          {e.text}
        </span>
        <span style={{ fontSize: 13.5, color: "#A79F90", textAlign: "right" }}>{e.meaning}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#C3BEB2", whiteSpace: "nowrap" }}>
          {statusLabel(e)}
        </span>
      </button>

      {open && (
        <div style={{ padding: "6px 0 22px", animation: "riseIn 200ms ease both" }}>
          <div
            style={{
              padding: "18px 20px",
              background: "#F4F1E9",
              borderRadius: 3,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <EditField label="Word or phrase" value={form.text} onChange={(v) => setForm({ ...form, text: v })} serif />
                <EditField label="Meaning" value={form.meaning} onChange={(v) => setForm({ ...form, meaning: v })} />
                <EditField label="Original example" value={form.example} onChange={(v) => setForm({ ...form, example: v })} serif />
                <EditField label="Source" value={form.source} onChange={(v) => setForm({ ...form, source: v })} mono />
                <EditField
                  label="Synonyms (comma-separated)"
                  value={form.synonyms}
                  onChange={(v) => setForm({ ...form, synonyms: v })}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button
                    onClick={saveEdit}
                    disabled={editSaving || !form.text.trim()}
                    style={{
                      border: "1px solid #171614",
                      background: editSaving || !form.text.trim() ? "#B4AFA3" : "#171614",
                      color: "#FBFAF7",
                      fontSize: 13,
                      padding: "8px 16px",
                      borderRadius: 2,
                      cursor: editSaving || !form.text.trim() ? "default" : "pointer",
                    }}
                  >
                    {editSaving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    style={{ border: "1px solid #DCD7CB", background: "none", fontSize: 13, padding: "8px 16px", borderRadius: 2, cursor: "pointer", color: "#171614" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                    <span style={cap}>
                      Original example <SpeakButton text={e.example} /> <SpeakButton text={e.text} />
                    </span>
                    <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 18, fontStyle: "italic", color: "#3A3730" }}>
                      {e.example || "—"}
                    </span>
                  </div>
                  <button
                    onClick={startEdit}
                    style={{ border: "none", background: "none", fontSize: 13, color: "#A9563C", cursor: "pointer", padding: 0 }}
                  >
                    Edit
                  </button>
                </div>
                {e.synonyms.length > 0 && <SynonymTags synonyms={e.synonyms} />}
                {e.source && <SourceLink source={e.source} />}
              </>
            )}
          </div>

          <div style={{ marginTop: 18 }}>
            <span style={cap}>Past sentences</span>
            {loading && <div style={{ color: "#B4AFA3", fontSize: 13, marginTop: 8 }}>Loading…</div>}
            {!loading && history && history.length === 0 && (
              <div style={{ color: "#B4AFA3", fontSize: 13, marginTop: 8 }}>No past sentences yet.</div>
            )}
            {!loading && history && history.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
                {history.map((h) => (
                  <div key={h.id} style={{ display: "flex", gap: 14, alignItems: "baseline", borderLeft: "1px solid #EDE9E0", paddingLeft: 14 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#C3BEB2", minWidth: 52 }}>
                      {h.reviewDate ? formatShort(h.reviewDate) : ""}
                    </span>
                    <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 18, lineHeight: 1.5, color: "#6D6961", flex: 1 }}>
                      {h.sentence}
                    </span>
                    {h.result && (
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: h.result === "Remembered" ? "#4E6E52" : "#A9563C" }}>
                        {h.result}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
              <input
                value={draft}
                onChange={(ev) => setDraft(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") addPast();
                }}
                placeholder="Add a past sentence you've used…"
                style={{ ...control, flex: 1 }}
              />
              <button
                onClick={addPast}
                disabled={saving || !draft.trim()}
                style={{
                  border: "1px solid #171614",
                  background: saving || !draft.trim() ? "#B4AFA3" : "#171614",
                  color: "#FBFAF7",
                  fontSize: 13,
                  padding: "9px 16px",
                  borderRadius: 2,
                  cursor: saving || !draft.trim() ? "default" : "pointer",
                }}
              >
                {saving ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  serif,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  serif?: boolean;
  mono?: boolean;
}) {
  const font = serif ? "'Instrument Serif', serif" : mono ? "'IBM Plex Mono', monospace" : "inherit";
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={cap}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: "1px solid #E3DCCE",
          background: "#FBFAF7",
          borderRadius: 2,
          padding: "8px 10px",
          fontFamily: font,
          fontSize: mono ? 13 : 16,
          color: "#171614",
        }}
      />
    </label>
  );
}
