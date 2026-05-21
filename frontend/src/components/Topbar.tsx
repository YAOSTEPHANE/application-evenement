"use client";

import Image from "next/image";

import { AppIcon } from "@/components/icons/AppIcon";

type TopbarProps = {
  userInitials?: string;
  userFullName?: string;
  userAvatarUrl?: string;
  /** Notifications métier non lues (pastille cloche). */
  notificationUnread?: number;
  onOpenAlerts?: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  onSearchChange?: (value: string) => void;
  themeMode?: "light" | "dark";
  onToggleTheme?: () => void;
};

export function Topbar({
  userInitials = "AD",
  userFullName = "Aminata Diallo",
  userAvatarUrl = "",
  notificationUnread = 0,
  onOpenAlerts,
  onOpenProfile,
  onOpenSettings,
  onSearchChange,
  themeMode = "light",
  onToggleTheme,
}: TopbarProps) {
  return (
    <header id="topbar">
      <div className="logo">
        <div className="logo-mark" aria-hidden="true">
          <AppIcon name="package" size={18} />
        </div>
        Stock<span>Event</span> Pro
      </div>

      <div className="top-search-wrap">
        <span className="search-icon" aria-hidden="true">
          <AppIcon name="search" size={16} />
        </span>
        <input
          className="top-search"
          type="text"
          id="globalSearch"
          placeholder="Rechercher article, événement…"
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      </div>

      <div className="top-right">
        <button
          type="button"
          className="icon-btn"
          onClick={() => onToggleTheme?.()}
          title={themeMode === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
          aria-label={themeMode === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
        >
          <AppIcon name={themeMode === "dark" ? "themeSun" : "themeMoon"} size={18} />
        </button>

        <button
          type="button"
          className="icon-btn icon-btn--notif"
          onClick={() => onOpenAlerts?.()}
          title={
            notificationUnread > 0
              ? `${notificationUnread} notification(s) non lue(s)`
              : "Alertes et notifications"
          }
        >
          <AppIcon name="alerts" size={18} />
          {notificationUnread > 0 ? (
            <span className="notif-dot notif-dot--count" id="notifDot" aria-hidden="true">
              {notificationUnread > 9 ? "9+" : notificationUnread}
            </span>
          ) : null}
        </button>

        <button type="button" className="icon-btn" onClick={() => onOpenSettings?.()} title="Paramètres">
          <AppIcon name="settings" size={18} />
        </button>

        <button type="button" className="user-chip" onClick={() => onOpenProfile?.()}>
          <div className="user-av" id="topUserAv" aria-hidden="true">
            {userAvatarUrl ? (
              <Image
                src={userAvatarUrl}
                alt={userFullName}
                fill
                className="avatar-image"
                sizes="26px"
              />
            ) : (
              userInitials
            )}
          </div>
          <span className="user-name" id="topUserName">
            {userFullName}
          </span>
        </button>
      </div>
    </header>
  );
}
