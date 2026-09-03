"use client";

const cap: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "#A79F90",
};

/** Renders an expression's synonyms as small chips; nothing when empty. */
export default function SynonymTags({ synonyms }: { synonyms: string[] }) {
  if (!synonyms || synonyms.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={cap}>Synonyms</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {synonyms.map((s) => (
          <span
            key={s}
            style={{
              border: "1px solid #E3DCCE",
              borderRadius: 999,
              padding: "3px 12px",
              fontSize: 14,
              color: "#6D6961",
              background: "#FBFAF7",
            }}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
