"use client";
import { useEffect } from "react";

/** Registers the service worker after load (no-op if unsupported). */
export default function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    // If the page already finished loading (common — effects run after load),
    // register right away; otherwise wait for the load event.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
