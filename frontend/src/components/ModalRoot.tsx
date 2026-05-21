"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";

type ModalRootProps = {
  isOpen: boolean;
  children: ReactNode;
  id?: string;
  className?: string;
};

/**
 * Affiche l’overlay modal dans document.body pour un centrage viewport
 * (évite la grille #app et le overflow de #main).
 */
export function ModalRoot({ isOpen, children, id, className = "" }: ModalRootProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!mounted || !isOpen) {
    return null;
  }

  return createPortal(
    <div className={`modal-bg open ${className}`.trim()} id={id} role="presentation">
      {children}
    </div>,
    document.body,
  );
}
