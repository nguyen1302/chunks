"use client";
import { useCallback, useEffect, useState } from "react";
import type { Expression, ExpressionWithStats, Stats } from "@/lib/types";
import Header from "./components/Header";
import ReviewView from "./components/ReviewView";
import AddView from "./components/AddView";
import ProgressView from "./components/ProgressView";
import LibraryView from "./components/LibraryView";
import FlashcardView from "./components/FlashcardView";

type View = "review" | "cards" | "library" | "add" | "stats";

export default function Page() {
  const [view, setView] = useState<View>("review");
  const [queue, setQueue] = useState<Expression[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [all, setAll] = useState<ExpressionWithStats[] | null>(null);

  const loadQueue = useCallback(async (tag?: string) => {
    const res = await fetch("/api/review-queue" + (tag ? `?tag=${encodeURIComponent(tag)}` : ""));
    setQueue(res.ok ? await res.json() : []);
  }, []);
  const loadStats = useCallback(async () => {
    setStats(null);
    const res = await fetch("/api/stats");
    setStats(res.ok ? await res.json() : null);
  }, []);
  const loadAll = useCallback(async () => {
    setAll(null);
    const res = await fetch("/api/expressions");
    setAll(res.ok ? await res.json() : []);
  }, []);

  // On load, run the daily study drip (activate today's new words), then load
  // the queue so newly-activated words are included.
  useEffect(() => {
    (async () => {
      try {
        await fetch("/api/study/tick");
      } catch {
        /* drip is best-effort */
      }
      loadQueue();
    })();
  }, [loadQueue]);
  useEffect(() => {
    if (view === "stats") loadStats();
    if (view === "library" || view === "cards" || view === "review") loadAll();
  }, [view, loadStats, loadAll]);

  const allTags = [...new Set((all ?? []).flatMap((e) => e.tags))].sort();

  const startSession = useCallback(() => {
    setView("review");
    loadQueue();
  }, [loadQueue]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FBFAF7",
        color: "#171614",
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Header view={view} setView={setView} />
      <main style={{ width: "100%", maxWidth: 780, padding: "0 clamp(16px, 5vw, 32px) 96px", flex: 1 }}>
        {view === "review" && (
          <ReviewView
            queue={queue}
            onStartSession={startSession}
            goAdd={() => setView("add")}
            goStats={() => setView("stats")}
            allTags={allTags}
            onPickTopic={(tag) => loadQueue(tag || undefined)}
          />
        )}
        {view === "cards" && <FlashcardView expressions={all} />}
        {view === "library" && <LibraryView expressions={all} onReload={loadAll} />}
        {view === "add" && <AddView onAdded={loadQueue} />}
        {view === "stats" && <ProgressView stats={stats} onStartSession={startSession} />}
      </main>
    </div>
  );
}
