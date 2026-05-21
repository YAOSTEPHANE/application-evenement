import type { ReactNode } from "react";

import { AppIcon, type AppIconName } from "@/components/icons/AppIcon";

export type PageHeaderProps = {
  icon: AppIconName;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

/** En-tête de page unifié (catalogue, entrepôts, CDC, etc.) */
export function PageHeader({ icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-icon">
        <span className="icon-badge">
          <AppIcon name={icon} size={22} />
        </span>
        <div>
          <h1>{title}</h1>
          {subtitle ? <p className="page-sub">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  );
}
