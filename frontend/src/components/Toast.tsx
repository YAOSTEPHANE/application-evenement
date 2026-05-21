"use client";

import { useEffect, useState } from "react";

import { AppIcon, type AppIconName } from "@/components/icons/AppIcon";
import type { ToastItem, ToastType } from "@/lib/toast/types";

type ToastViewportProps = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

const TONE_META: Record<
  ToastType,
  { icon: AppIconName; label: string; className: string }
> = {
  ok: { icon: "check", label: "Succès", className: "toast-item--ok" },
  danger: { icon: "alert", label: "Erreur", className: "toast-item--danger" },
  warn: { icon: "alert", label: "Attention", className: "toast-item--warn" },
  info: { icon: "documents", label: "Information", className: "toast-item--info" },
  default: { icon: "sync", label: "Notification", className: "toast-item--default" },
};

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [entered, setEntered] = useState(false);
  const meta = TONE_META[item.type];

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`toast-item ${meta.className}${entered ? " toast-item--show" : ""}`}
      style={{ ["--toast-duration" as string]: `${item.durationMs}ms` }}
    >
      <span className="toast-item-icon" aria-hidden>
        <AppIcon name={meta.icon} size={18} />
      </span>
      <div className="toast-item-body">
        {item.title ? <p className="toast-item-title">{item.title}</p> : null}
        <p className="toast-item-message">{item.message}</p>
      </div>
      <button
        type="button"
        className="toast-item-close"
        aria-label="Fermer la notification"
        onClick={() => onDismiss(item.id)}
      >
        <AppIcon name="close" size={14} />
      </button>
      <span className="toast-item-progress" aria-hidden />
    </div>
  );
}

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-viewport" aria-label="Notifications">
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

/** @deprecated Utiliser ToastViewport via ToastProvider */
export function Toast({
  message,
  visible,
  type = "default",
}: {
  message: string;
  visible: boolean;
  type?: ToastType;
}) {
  if (!visible || !message) return null;
  const item: ToastItem = {
    id: "legacy",
    message,
    type,
    durationMs: 3200,
  };
  return (
    <div className="toast-viewport toast-viewport--legacy" aria-label="Notifications">
      <ToastCard item={item} onDismiss={() => undefined} />
    </div>
  );
}
