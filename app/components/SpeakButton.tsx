"use client";
import { useEffect, useState } from "react";

/** Speaks `text` in en-US via the Web Speech API. Renders nothing when the
 * browser has no speechSynthesis (e.g. SSR or unsupported). */
export default function SpeakButton({ text, size = 16 }: { text: string; size?: number }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);
  if (!ok || !text) return null;

  function speak(e: React.MouseEvent) {
    e.stopPropagation();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  return (
    <button
      onClick={speak}
      aria-label="Play pronunciation"
      title="Play pronunciation"
      style={{
        border: "none",
        background: "none",
        cursor: "pointer",
        padding: 4,
        color: "#A9563C",
        lineHeight: 0,
        verticalAlign: "middle",
        display: "inline-flex",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  );
}
