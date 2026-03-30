"use client";

import { useEffect, useRef, useState } from "react";

export type ToastType = "ok" | "danger" | "default";

export function useToast() {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const [type, setType] = useState<ToastType>("default");
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  function showToast(nextMessage: string, nextType: ToastType = "default") {
    setMessage(nextMessage);
    setType(nextType);
    setVisible(true);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setVisible(false);
    }, 3200);
  }

  return {
    toast: { message, visible, type },
    showToast,
  };
}

