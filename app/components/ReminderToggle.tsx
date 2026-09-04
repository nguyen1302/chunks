"use client";
import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = "unsupported" | "loading" | "on" | "off" | "denied";

export default function ReminderToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setState("unsupported");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setState(res.ok ? "on" : "off");
    } catch {
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;

  const cap: React.CSSProperties = { fontSize: 11, letterSpacing: "0.09em", textTransform: "uppercase", color: "#B4AFA3" };
  const note = (t: string) => <span style={{ fontSize: 12.5, color: "#A79F90" }}>{t}</span>;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={cap}>Daily reminders</span>
        {state === "unsupported" && note("Not available here — install the app to your home screen first (iOS 16.4+).")}
        {state === "denied" && note("Notifications are blocked in your browser settings.")}
        {state === "off" && note("Get a nudge when words are due.")}
        {state === "on" && note("On — you'll be reminded when words are due.")}
      </div>
      {(state === "on" || state === "off") && (
        <button
          onClick={state === "on" ? disable : enable}
          disabled={busy}
          style={{
            border: "1px solid " + (state === "on" ? "#DCD7CB" : "#171614"),
            background: state === "on" ? "none" : "#171614",
            color: state === "on" ? "#171614" : "#FBFAF7",
            fontSize: 13,
            padding: "8px 16px",
            borderRadius: 2,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "…" : state === "on" ? "Turn off" : "Turn on"}
        </button>
      )}
    </div>
  );
}
