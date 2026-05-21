"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
};

/** Panneau repliable pour guides métier (hors texte CDC dashboard). */
export function ModuleGuideCollapse({ title, children, className = "", defaultOpen = false }: Props) {
  return (
    <details className={`module-guide-collapse ${className}`.trim()} open={defaultOpen || undefined}>
      <summary className="module-guide-collapse-summary">{title}</summary>
      <div className="module-guide-collapse-body">{children}</div>
    </details>
  );
}
