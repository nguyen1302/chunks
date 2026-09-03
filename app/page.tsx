"use client";
import { useCallback, useEffect, useState } from "react";
import type { Expression, Stats } from "@/lib/types";
import Header from "./components/Header";
import ReviewView from "./components/ReviewView";
import AddView from "./components/AddView";
import ProgressView from "./components/ProgressView";

type View = "review" | "add" | "stats";

export default function Page() {
  const [view, setView] = useState<View>("review");
  const [queue, setQueue] = useState<Expression[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const loadQueue = useCallback(async () => {
    const res = await fetch("/api/review-queue");
    setQueue(res.ok ? await res.json() : []);
  }, []);
  const loadStats = useCallback(async () => {
    const res = await fetch("/api/stats");
    setStats(res.ok ? await res.json() : null);
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);
  useEffect(() => {
    if (view === "stats") loadStats();
  }, [view, loadStats]);

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
      <main style={{ width: "100%", maxWidth: 780, padding: "0 32px 96px", flex: 1 }}>
        {view === "review" && (
          <ReviewView
            queue={queue}
            onStartSession={startSession}
            goAdd={() => setView("add")}
            goStats={() => setView("stats")}
          />
        )}
        {view === "add" && <AddView onAdded={loadQueue} />}
        {view === "stats" && <ProgressView stats={stats} onStartSession={startSession} />}
      </main>
    </div>
  );
}
