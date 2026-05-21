"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ToastViewport } from "@/components/Toast";
import { defaultDurationMs, inferToastType } from "@/lib/toast/infer-toast-type";
import type { ShowToastOptions, ToastItem, ToastType } from "@/lib/toast/types";

const MAX_TOASTS = 5;

type ToastContextValue = {
  toasts: ToastItem[];
  showToast: (message: string, typeOrOptions?: ToastType | ShowToastOptions) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function parseShowArgs(
  message: string,
  typeOrOptions?: ToastType | ShowToastOptions,
): Omit<ToastItem, "id" | "createdAt"> & { durationMs: number } {
  const opts: ShowToastOptions =
    typeof typeOrOptions === "string" ? { type: typeOrOptions } : (typeOrOptions ?? {});
  const type = inferToastType(message, opts.type);
  return {
    message,
    type,
    title: opts.title,
    durationMs: opts.durationMs ?? defaultDurationMs(type),
  };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, typeOrOptions?: ToastType | ShowToastOptions) => {
      const trimmed = message.trim();
      if (!trimmed) return;

      const payload = parseShowArgs(trimmed, typeOrOptions);
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const item: ToastItem = { id, ...payload };

      setToasts((prev) => {
        const next = [...prev, item];
        if (next.length > MAX_TOASTS) {
          const dropped = next[0];
          const t = timersRef.current.get(dropped.id);
          if (t) {
            window.clearTimeout(t);
            timersRef.current.delete(dropped.id);
          }
          return next.slice(-MAX_TOASTS);
        }
        return next;
      });

      const timer = window.setTimeout(() => dismissToast(id), payload.durationMs);
      timersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) {
        window.clearTimeout(timer);
      }
      timersRef.current.clear();
    },
    [],
  );

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToastContext doit être utilisé dans un ToastProvider");
  }
  return ctx;
}

/** Compatible avec l’ancien hook (message unique) — préférer useToastContext dans les nouveaux écrans. */
export function useToast() {
  const { toasts, showToast, dismissToast } = useToastContext();
  const latest = toasts[toasts.length - 1];
  return {
    toast: {
      message: latest?.message ?? "",
      visible: Boolean(latest),
      type: latest?.type ?? "default",
    },
    showToast,
    dismissToast,
    toasts,
  };
}
