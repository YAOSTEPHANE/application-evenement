"use client";

import { useEffect, useState } from "react";

import { AppIcon } from "@/components/icons/AppIcon";

type GroupSpec = {
  id: string;
  title: string;
  description: string;
  rules: string[];
};

type Spec = {
  groups: GroupSpec[];
};

export function HrPersonnelCategoriesGuide({ className = "" }: { className?: string }) {
  const [spec, setSpec] = useState<Spec | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/cdc/hr/categories");
      if (res.ok && !cancelled) setSpec((await res.json()) as Spec);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!spec) return null;

  return (
    <section className={`hr-personnel-guide ${className}`.trim()}>
      <div className="hr-personnel-guide-hd">
        <AppIcon name="team" size={18} />
        <h2 className="hr-personnel-guide-title">Catégories d&apos;effectif</h2>
      </div>
      <div className="hr-personnel-guide-grid">
        {spec.groups.map((g) => (
          <article key={g.id} className="hr-personnel-guide-card">
            <h3>{g.title}</h3>
            <p className="fs12 text-muted">{g.description}</p>
            <ul className="hr-personnel-guide-rules">
              {g.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
