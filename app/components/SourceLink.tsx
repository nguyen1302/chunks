"use client";
import { isUrl } from "@/lib/url";

const style: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11.5,
  color: "#A79F90",
};

/** Renders a Source string; if it is a URL, as a link that opens a new tab. */
export default function SourceLink({ source }: { source: string }) {
  if (!source) return null;
  if (isUrl(source)) {
    return (
      <a href={source} target="_blank" rel="noopener noreferrer" style={{ ...style, color: "#A9563C" }}>
        {source}
      </a>
    );
  }
  return <span style={style}>{source}</span>;
}
