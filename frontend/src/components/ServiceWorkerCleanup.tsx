"use client";

import { useEffect } from "react";

const RELOAD_FLAG = "stockevent-sw-cleanup-done";

/**
 * En développement, désinscrit les anciens service workers et vide le Cache Storage
 * (évite les chunks React/Turbopack obsolètes).
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    void (async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) return;

      await Promise.all(registrations.map((r) => r.unregister()));

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      if (!sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
      }
    })();
  }, []);

  return null;
}
