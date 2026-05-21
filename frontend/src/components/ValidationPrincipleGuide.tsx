"use client";

import { useEffect, useState } from "react";

import { AppIcon } from "@/components/icons/AppIcon";

type CriticalAction = {
  id: string;
  label: string;
  description: string;
  usesSignatureMatrix: boolean;
  mayRequire2Fa: boolean;
};

type Catalog = {
  principle: string;
  criticalActions: CriticalAction[];
};

export function ValidationPrincipleGuide({ className = "" }: { className?: string }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/cdc/validation/matrix");
      if (res.ok && !cancelled) {
        const data = (await res.json()) as Catalog;
        setCatalog(data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!catalog) return null;

  return (
    <section className={`val-principle-guide ${className}`.trim()}>
      <div className="val-principle-guide-hd">
        <AppIcon name="signature" size={18} />
        <div>
          <h2 className="val-principle-guide-title">Principe de validation</h2>
          <p className="val-principle-guide-sub fs12 text-muted">{catalog.principle}</p>
        </div>
      </div>
      <ul className="val-principle-actions">
        {catalog.criticalActions.map((a) => (
          <li key={a.id} className="val-principle-action">
            <span className="val-principle-action-label">{a.label}</span>
            <span className="val-principle-action-desc">{a.description}</span>
            <span className="val-principle-tags">
              {a.usesSignatureMatrix ? (
                <span className="val-principle-tag">Matrice signatures</span>
              ) : null}
              {a.mayRequire2Fa ? <span className="val-principle-tag">2FA possible</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
