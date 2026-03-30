"use client";

import Image from "next/image";

type TopbarProps = {
  userInitials?: string;
  userFullName?: string;
  userAvatarUrl?: string;
  onOpenAlerts?: () => void;
  onOpenProfile?: () => void;
  onSearchChange?: (value: string) => void;
};

export function Topbar({
  userInitials = "AD",
  userFullName = "Aminata Diallo",
  userAvatarUrl = "",
  onOpenAlerts,
  onOpenProfile,
  onSearchChange,
}: TopbarProps) {
  return (
    <header id="topbar">
      <div className="logo">
        <div className="logo-mark" aria-hidden="true">
          📦
        </div>
        Stock<span>Event</span> Pro
      </div>

      <div className="top-search-wrap">
        <span className="search-icon" aria-hidden="true">
          ⌕
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
          onClick={() => onOpenAlerts?.()}
          title="Alertes"
        >
          <span aria-hidden="true">🔔</span>
          <span className="notif-dot" id="notifDot" aria-hidden="true" />
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

